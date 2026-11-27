"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "ursinho-package-validity-"));
process.env.AUTOMATION_DB_FILE = path.join(temp, "automation.json");

const tenantService = require("../src/automation/services/tenantService");
const storefrontService = require("../src/automation/services/storefrontService");

test.after(() => {
    fs.rmSync(temp, { recursive: true, force: true });
});

function prepararLoja() {
    const tenant = tenantService.criarTenant({ nome: "Tenant Pacotes" });
    assert.equal(tenant.error, undefined);
    const slug = "tenant-pacotes-" + tenant.id.slice(-8).toLowerCase();
    const store = storefrontService.configurarLoja(tenant.id, {
        slug,
        nome: "Pacotes Tenant",
        publicado: true,
        metodosPagamento: []
    });
    assert.equal(store.error, undefined);
    return { tenant, store: store.loja, slug };
}

test("cria pacotes diários, semanais, mensais e personalizados com validade explícita", () => {
    const { tenant } = prepararLoja();

    const daily = storefrontService.criarProduto(tenant.id, {
        nome: "500 MB Diário",
        precoMT: 15,
        quantidadeMB: 500,
        categoria: "DIARIO"
    });
    const weekly = storefrontService.criarProduto(tenant.id, {
        nome: "1 GB Semanal",
        precoMT: 25,
        quantidadeMB: 1024,
        categoria: "SEMANAL"
    });
    const monthly = storefrontService.criarProduto(tenant.id, {
        nome: "5 GB Mensal",
        precoMT: 100,
        quantidadeMB: 5120,
        categoria: "MENSAL"
    });
    const custom = storefrontService.criarProduto(tenant.id, {
        nome: "Pacote Especial",
        precoMT: 40,
        quantidadeMB: 2048,
        categoria: "PERSONALIZADO",
        validadeDias: 14
    });

    assert.equal(daily.produto.categoria, "DIARIO");
    assert.equal(daily.produto.validadeDias, 1);
    assert.equal(weekly.produto.validadeDias, 7);
    assert.equal(monthly.produto.validadeDias, 30);
    assert.equal(custom.produto.validadeDias, 14);
});

test("rejeita validade incompatível com categoria fixa", () => {
    const { tenant } = prepararLoja();
    const result = storefrontService.criarProduto(tenant.id, {
        nome: "Pacote diário incorreto",
        precoMT: 20,
        quantidadeMB: 1024,
        categoria: "DIARIO",
        validadeDias: 30
    });

    assert.match(result.error, /validade fixa de 1 dia/);
});

test("alterar categoria diária recalcula validade e o catálogo público conserva o pacote", () => {
    const { tenant, slug } = prepararLoja();
    const created = storefrontService.criarProduto(tenant.id, {
        nome: "Pacote mensal",
        precoMT: 50,
        quantidadeMB: 1024,
        categoria: "MENSAL"
    });
    assert.equal(created.produto.validadeDias, 30);

    const updated = storefrontService.atualizarProduto(
        tenant.id,
        created.produto.id,
        { categoria: "DIARIO" }
    );
    assert.equal(updated.produto.categoria, "DIARIO");
    assert.equal(updated.produto.validadeDias, 1);

    const catalog = storefrontService.catalogoPublico(slug);
    const product = catalog.produtos.find(item => item.id === created.produto.id);
    assert.equal(product.categoria, "DIARIO");
    assert.equal(product.validadeDias, 1);
});

test("o pedido guarda uma cópia da categoria e validade do pacote escolhido", () => {
    const { tenant } = prepararLoja();
    const product = storefrontService.criarProduto(tenant.id, {
        nome: "Pacote 1 GB Mensal",
        precoMT: 30,
        quantidadeMB: 1024,
        categoria: "MENSAL"
    });
    assert.equal(product.error, undefined);

    const order = storefrontService.criarPedidoPublico(
        "tenant-pacotes-validade",
        {
            nome: "Cliente Teste",
            telefone: "841234567",
            items: [{ productId: product.produto.id, quantity: 1 }]
        },
        "package-validity-order-01"
    );
    assert.equal(order.error, undefined);
    assert.equal(order.pedido.items[0].categoria, "MENSAL");
    assert.equal(order.pedido.items[0].validadeDias, 30);
});
