import { expect, test } from "@playwright/test";
import { entrar, emendaValida, irParaEtapa3, sql } from "./apoio";

// D7: documento da emenda (capa do processo, emenda no modelo da Câmara e
// plano de trabalho anexo), minuta antes do envio e definitivo depois.

test.afterAll(async () => {
  await sql(`delete from "Emenda" where objeto like 'D7 %'`);
});

test.describe("D7 — documento da emenda", () => {
  test("minuta na etapa 3 e definitivo, com número, depois do envio", async ({ page }) => {
    await entrar(page, "vereador");
    const id = await emendaValida(page, "D7 Aquisição de cadeiras de rodas para a unidade de saúde");

    // Etapa 3, seção do envio: o atalho para a minuta.
    await irParaEtapa3(page, id, "envio");
    const caixa = page.locator('[data-guia="nova-emenda.documento"]');
    await expect(caixa).toContainText("Documento da emenda — minuta");
    await expect(caixa.getByRole("link", { name: "Ver minuta" })).toHaveAttribute("href", `/emendas/${id}/documento`);

    // Minuta: sem número, com marca d'água e o conteúdo da emenda.
    await page.goto(`/emendas/${id}/documento`);
    const corpo = page.locator("body");
    await expect(page.locator('[data-doc="minuta"]').first()).toBeVisible();
    await expect(corpo).toContainText("EI —/2027");
    await expect(page.locator('[data-doc="capa"]')).toContainText("EMENDA IMPOSITIVA");
    await expect(page.locator('[data-doc="capa"]')).toContainText("Emenda Impositiva nº — ao Projeto de Lei nº 264/2026.");
    await expect(page.locator('[data-doc="capa"]')).toContainText("PODER LEGISLATIVO");
    await expect(page.locator('[data-doc="titulo"]')).toHaveText("EMENDA Nº —/2027");
    await expect(corpo).toContainText("Emenda ao Quadro de Detalhamento da Despesa da Lei Orçamentária Anual do exercício de 2027.");
    await expect(corpo).toContainText("Art. 166, § 9º da Constituição Federal.");
    await expect(corpo).toContainText("Projeto de Lei nº 264/2026 –");
    await expect(corpo).toContainText("D7 Aquisição de cadeiras de rodas");
    await expect(corpo).toContainText("(três mil reais)");
    // Art. 2º: a reserva configurada (ficha 1208) é a dotação anulada.
    await expect(corpo).toContainText("99.999.9999.9999 RESERVA DE CONTINGÊNCIA");
    await expect(corpo).toContainText("Ficha 1208");
    await expect(corpo).toContainText("Art. 3º A presente emenda produz reflexos nos quadros do Plano Plurianual");
    await expect(corpo).toContainText("ANEXO — PLANO DE TRABALHO");
    await expect(corpo).toContainText("Cadeira de rodas");
    await expect(corpo).toContainText("Rua José Colombo, 235");
    const brasao = page.getByRole("img", { name: "Brasão" }).first();
    await expect(brasao).toBeVisible();
    expect(await brasao.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(100);
    await expect(page.getByRole("button", { name: "Imprimir / Salvar como PDF" })).toBeVisible();

    // Enviada: número, data de entrada e nada de minuta.
    await sql(`update "Emenda" set status = 'SUBMETIDA', numero = 977, "submetidaEm" = '2026-10-08T17:30:00Z' where id = $1`, [id]);
    await page.goto(`/emendas/${id}`);
    await expect(page.getByRole("link", { name: "Documento da emenda" })).toHaveAttribute("href", `/emendas/${id}/documento`);
    await page.goto(`/emendas/${id}/documento`);
    await expect(page.locator('[data-doc="titulo"]')).toHaveText("EMENDA Nº 977/2027");
    await expect(page.locator('[data-doc="capa"]')).toContainText("Emenda Impositiva nº 977 ao Projeto de Lei nº 264/2026.");
    await expect(page.locator('[data-doc="capa"]')).toContainText("08/10/2026");
    await expect(page.locator('[data-doc="capa"]')).toContainText("14:30");
    await expect(corpo).toContainText("Câmara Municipal de Mogi Guaçu, 8 de outubro de 2026.");
    await expect(corpo).toContainText("Emenda nº 977/2027");
    await expect(page.getByText("MINUTA")).toHaveCount(0);

    // Impressão: cada página leva "EI 977/2027 | Fls. n/m" e o rodapé da Câmara.
    const pdf = await page.pdf({ format: "A4", preferCSSPageSize: true });
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const arq = await pdfjs.getDocument({ data: new Uint8Array(pdf) }).promise;
    expect(arq.numPages).toBeGreaterThanOrEqual(3);
    const paginas: string[] = [];
    for (let n = 1; n <= arq.numPages; n++) {
      const t = await (await arq.getPage(n)).getTextContent();
      paginas.push(t.items.map((i) => ("str" in i ? i.str : "")).join(" "));
    }
    paginas.forEach((p, i) => {
      expect(p.replace(/\s+/g, " ")).toContain(`EI 977/2027 | Fls. ${i + 1}/${arq.numPages}`);
      expect(p).toContain("Rua José Colombo, 235");
    });
    expect(paginas[0]).toContain("SECRETARIA DA CÂMARA");
    expect(paginas.join(" ")).toContain("ANEXO — PLANO DE TRABALHO");
  });

  test("Configurações: a dotação de reserva e o fundamento do documento", async ({ page }) => {
    await entrar(page, "admin");
    await page.goto("/config?aba=exercicio");
    await expect(page.locator("#c-reserva")).toHaveValue("1208");
    await expect(page.locator("#c-fundoc")).toHaveValue(/Art\. 166, § 9º da Constituição Federal\./);
    await page.goto("/config?aba=municipio");
    await expect(page.locator("#mu-endereco")).toHaveValue("Rua José Colombo, 235 — Mogi Guaçu-SP");
    await expect(page.locator("#mu-rodape")).toHaveValue(/CEP 13840-065/);
  });
});
