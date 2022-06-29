import { useSession, signIn } from "next-auth/react";
import { api } from "../../services/api";
import { getStripeJs } from "../../services/stripe-js";
import styles from "./styles.module.scss"

interface SubscribeButtonProps{
    priceId:string;
}

export function SubscribeButton({ priceId}: SubscribeButtonProps) {

    const {data: session} = useSession() // HOOK PARA SABER ESTA LOGADO

    async function handleSubscribe(){

        if (!session){ // SE NÃO ESTIVER LOGADO
            signIn("github") // ATIVA FUNÇÃO PARA LOGAR
            return;
        }

        try{
            const response = await api.post("/subscribe") // api IMPORTADA DO AXIOS, /subscribe = nome do arquivo

            // RESPOSTA DA REQUISIÇÃO
            const { sessionId } = response.data

            // IMPORTADA DO /services/stripe-js
            const stripe = await getStripeJs()

            // REDIRECIONA PARA O CHECKOUT PASSANDO O ID DA TRANSAÇÃO
            await stripe.redirectToCheckout({sessionId: sessionId})

        } catch(err){
            alert(err.message)
        }

    }

    return (
        <button type="button" onClick={handleSubscribe}
            className={styles.subscribeButton}>
            Subscribe now
        </button>
    )
}