import "server-only";
import { tentativas } from "./rate-limit";

// Senha errada 5 vezes em 15 minutos bloqueia a conta por 15 minutos, mesmo
// com a senha certa; 30 erros do mesmo endereço de rede também bloqueiam.
export const LOGIN_MAX_FALHAS = 5;
export const LOGIN_MAX_FALHAS_IP = 30;
export const LOGIN_JANELA_MS = 15 * 60_000;

export const chaveFalhaEmail = (email: string) => `login-falha:${email}`;
export const chaveFalhaIp = (ip: string) => `login-falha-ip:${ip}`;

export async function loginBloqueado(email: string, ip: string): Promise<boolean> {
  const [porEmail, porIp] = await Promise.all([
    tentativas(chaveFalhaEmail(email), LOGIN_JANELA_MS),
    tentativas(chaveFalhaIp(ip), LOGIN_JANELA_MS),
  ]);
  return porEmail >= LOGIN_MAX_FALHAS || porIp >= LOGIN_MAX_FALHAS_IP;
}
