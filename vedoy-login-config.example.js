// Kopier til vedoy-login-config.js ved deploy. Denne filen skal aldri inneholde
// Supabase secret/service_role-nøkler. Login-endepunktet må validere `next`
// server-side mot en tillattliste før omdirigering.
window.VEDOY_LOGIN_URL = "https://DIN-VEDOY-LOGIN-DOMENE/api/vedoy-login/start";
