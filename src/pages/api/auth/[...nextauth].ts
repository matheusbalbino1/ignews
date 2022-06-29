import NextAuth from "next-auth"
import GithubProvider from "next-auth/providers/github"
import { query } from "faunadb"

import { fauna } from "../../../services/fauna"

export default NextAuth({
    // Configure one or more authentication providers
    providers: [
        GithubProvider({
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
            authorization: {
                params: {
                    scope: "read:user"
                }
            }
        }),

        // ...add more providers here
    ],
    secret: process.env.SIGNIN_KEY,
    callbacks: { //FUNÇÕES RETORNADAS APÓS ACONTECER ALGO

        // FUNÇÃO RETORNA TRUE APÓS O SIGNIN
        async signIn({ user, account, profile, email, credentials }) {

            try {
                // CRIAR O USUARIO SE ELE AINDA NÃO EXISTIR
                await fauna.query(
                    query.If( // SE
                        query.Not( // NAO COM ESSAS CONDIÇÕES
                            query.Exists( // EXISTIR
                                query.Match( // QUE COMBINE
                                    query.Index("user_by_email"), // NO INDEX USER_BY_EMAIL
                                    query.Casefold(user.email) // query.casefold PARA DEIXAR EM MINUSCULO
                                )
                            )
                        ), // SE NÃO EXISTIR FAÇA ISSO
                        query.Create( // CRIE
                            query.Collection("users"), // NA COLEÇÃO USERS
                            {
                                data: {
                                    email
                                }
                            }
                        ), // SE EXISTIR BUSQUE AS INFORMAÇÕES DELE
                        query.Get(  // OBTER
                            query.Match( // COMBINE
                                query.Index("user_by_email"),
                                query.Casefold(user.email)
                            )
                        )
                    )
                )

                return true
            } catch {
                return false
            }
        }
    }
})