"use strict";

// O painel usa a mesma origem HTTPS do servidor. A chave fica apenas
// na sessionStorage desta aba e nunca é compilada no JavaScript.
const API_URL = window.location.origin;
const SESSION_KEY = "ursinhoBotDashboardApiKey";
let apiKey = sessionStorage.getItem(SESSION_KEY) || "";
let refreshTimer = null;

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function setOnline() {
    const status = document.getElementById("connectionStatus");
    const botStatus = document.getElementById("botStatus");
    if (status) {
        status.textContent = "● ONLINE";
        status.classList.remove("offline");
        status.classList.add("online");
    }
    if (botStatus) {
        botStatus.textContent = "ONLINE";
        botStatus.classList.add("online");
    }
}

function setOffline() {
    const status = document.getElementById("connectionStatus");
    const botStatus = document.getElementById("botStatus");
    if (status) {
        status.textContent = "● SEM RESPOSTA";
        status.classList.remove("online");
        status.classList.add("offline");
    }
    if (botStatus) {
        botStatus.textContent = "SEM RESPOSTA";
        botStatus.classList.remove("online");
    }
}

function formatNumber(value) {
    return Number(value || 0).toLocaleString("pt-BR");
}

function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("pt-BR");
}

function showLogin(message = "Acesso privado. Introduza a chave API do painel.") {
    document.getElementById("authGate")?.classList.remove("hidden");
    document.getElementById("appShell")?.classList.add("hidden");
    setText("authMessage", message);
    const input = document.getElementById("apiKeyInput");
    if (input) {
        input.value = "";
        input.focus();
    }
}

function showDashboard() {
    document.getElementById("authGate")?.classList.add("hidden");
    document.getElementById("appShell")?.classList.remove("hidden");
}

function clearCredentials() {
    apiKey = "";
    sessionStorage.removeItem(SESSION_KEY);
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = null;
    showLogin("Sessão terminada. Introduza novamente a chave API.");
}

async function loadDashboard() {
    if (!apiKey) return showLogin();

    try {
        const response = await fetch(`${API_URL}/api/dashboard`, {
            cache: "no-store",
            headers: { "x-api-key": apiKey }
        });

        if (response.status === 401 || response.status === 403) {
            clearCredentials();
            return;
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        if (!data.ok) throw new Error("API retornou resposta inválida.");

        showDashboard();
        setOnline();
        setText("messages", formatNumber(data.stats?.messages));
        setText("commands", formatNumber(data.stats?.commands));
        setText("groups", formatNumber(data.groups?.total));
        setText("activeSessions", formatNumber(data.sessions?.active));
        setText("historySessions", formatNumber(data.sessions?.history));
        setText("rentalCodes", formatNumber(data.rental?.codes));
        setText("botName", data.bot?.name || "URSINHO X BOT V2");
        setText("lastUpdate", formatDate(data.timestamp));
    } catch (error) {
        console.error("Erro ao carregar o dashboard:", error?.message || error);
        setOffline();
    }
}

document.getElementById("authForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = document.getElementById("apiKeyInput");
    const value = String(input?.value || "").trim();
    if (!value) return showLogin("A chave API é obrigatória.");
    apiKey = value;
    sessionStorage.setItem(SESSION_KEY, value);
    await loadDashboard();
    if (apiKey && !refreshTimer) refreshTimer = setInterval(loadDashboard, 15000);
});

document.getElementById("logoutButton")?.addEventListener("click", clearCredentials);

if (apiKey) {
    loadDashboard();
    refreshTimer = setInterval(loadDashboard, 15000);
} else {
    showLogin();
}
