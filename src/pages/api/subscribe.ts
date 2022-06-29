import { NextApiRequest, NextApiResponse } from "next";
import { stripe } from "../../services/stripe";
import { getSession } from "next-auth/react"
import { fauna } from "../../services/fauna";
import { query } from "faunadb"


type User = {
    ref: {
        id: string;
    }
}

export default async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method === "POST") { // SE A REQUISIÇÃO FOR DO TIPO POST

        const session = await getSession({ req }) // ENVIA A REQUISIÇÃO COMO PARAMETRO
        // session.user PARA OBTER O USUÁRIO

        // PARA NÃO CRIAR DOIS USUARIO IGUAIS
        // FUNÇÃO PARA OBTER O USUARIO LOGADO
        const user = await fauna.query<User>(
            query.Get( // BUSCAR UM USUARIO
                query.Match( // COMBINE
                    query.Index("user_by_email"), // QUE O EMAIL SEJA IGUAL O EMAIL LOGADO
                    query.Casefold(session.user.email)
                )
            )
        )

        // CRIAR O USUARIO NO STRIPE
        const stripeCustomer = await stripe.customers.create({
            email: session.user.email
        })

        
        // FUNÇÃO PARA ATUALIZAR AS INFO DO USUARIO LOGADO
        await fauna.query(
            query.Update( // ATUALIZAR UMA INFORMAÇÃO DO USUARIO
                query.Ref( // DA COLEÇÃO USERS
                    query.Collection("users"), user.ref.id
                ),
                {
                    // O VALOR QUE QUERO ATUALIZAR
                    data: {
                        stripe_customer_id: stripeCustomer.id
                    }
                }
            )
        )

        
        // PARA COMPRAR O PRODUTO APÓS CRIAR A CONTA DO USUARIO
        const checkoutSession = await stripe.checkout.sessions.create({
            customer: stripeCustomer.id, // ID DE QUEM ESTÁ COMPRANDO 
            payment_method_types: ["card"], // MÉTODO DE PAGAMENTO
            billing_address_collection: "required", // ENDEREÇO É OBRIGATORIO?
            line_items: [{ // CARRINHO DE COMPRAS, COMO É APENAS 1 PRODUTO PODE SER ESTÁTICO
                price: "price_1LDJ0OEcpgO0t4K4hQC2YFLD", quantity: 1 // ID DO PREÇO E QUANTIDADE
            }],
            mode: "subscription", // INSCRIÇÃO, PORQUE É RECORRENTE EX: NETFLIX, AMAZON PRIME
            allow_promotion_codes: true, // PERMITIR CUPOM DE DESCONTO? TRUE = SIM
            success_url: process.env.STRIPE_SUCESS_URL, // PARA ONDE REDIRECIONAR QUANDO DER SUCESSO ?
            cancel_url: process.env.STRIPE_CANCEL_URL // PARA ONDE REDIRECIONAR QUANDO DER ERRADO OU CANCELAR A COMPRA ?
        })

        return res.status(200).json({ sessionId: checkoutSession.id }) // RETORNA O ID DA COMPRA NA RESPOSTA

    } else { // SE NÃO FOR DO TIPO TIPO, RETORNO 405 E METODO NÃO PERMITIDO
        res.setHeader("Allow", "POST")
        res.status(405).end("Method not allowed")
    }
}