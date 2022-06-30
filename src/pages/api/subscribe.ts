import { NextApiRequest, NextApiResponse } from "next";
import { stripe } from "../../services/stripe";
import { getSession } from "next-auth/react"
import { fauna } from "../../services/fauna";
import { query } from "faunadb"


type User = {
    ref: {
        id: string;
    }
    data: {
        stripe_customer_id: string
    }
}

// ATIVADA AO CLICAR NO BOTÃO DE SUBSCRIBE NOW
export default async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method === "POST") { // SE A REQUISIÇÃO FOR DO TIPO POST

        // getSession É PARA OBTER O USUARIO QUE ESTÁ LOGADO
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

        // PARA VERIFICAR SE O USUARIO JA TEM A CONTA NO STRIPE
        let customerId = user.data.stripe_customer_id

        // SE NÃO TIVER CONTA NA STRIPE
        if (!customerId) {

            // CRIA O USUARIO NO STRIPE E RETORNA AS INFO(ID, EMAIL, etc) DO USUARIO PARA A VAR
            const stripeCustomer = await stripe.customers.create({
                email: session.user.email
            })

            // FUNÇÃO PARA SALVAR O ID DA STRIPE NO FAUNADB
            await fauna.query(
                query.Update( // ATUALIZAR UMA INFORMAÇÃO DO USUARIO
                    query.Ref( // DA COLEÇÃO USERS
                        query.Collection("users"), user.ref.id
                    ),
                    {
                        // ADICIONAR O ID DO STRIPE AO FAUNADB
                        data: {
                            stripe_customer_id: stripeCustomer.id
                        }
                    }
                )
            )

            customerId = stripeCustomer.id

        }

        // PARA COMPRAR O PRODUTO
        const checkoutSession = await stripe.checkout.sessions.create({
            customer: customerId, // ID DE QUEM ESTÁ COMPRANDO 
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