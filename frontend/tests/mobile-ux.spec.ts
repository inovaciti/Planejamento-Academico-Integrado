import { expect, test, type Page } from "@playwright/test";

// Celular de verdade: tela de 390×844 com toque.
test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});

/** Ingresso em 2024.1, 5º período: o 3º período é 2025.1 e o 1º, 2024.1. */
async function register(page: Page, name: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await page.getByLabel("E-mail").fill(`${name}@example.test`);
  await page.getByLabel("Senha", { exact: true }).fill("fictional-secret");
  await page.getByLabel("Confirmar senha").fill("fictional-secret");
  await page.getByLabel("Matrícula").fill(`${name}-registration`);
  await page.getByLabel("Semestre de ingresso").fill("2024.1");
  await page.getByLabel("Período atual").fill("5");
  await page.getByLabel("Curso").selectOption("SI");
  await page.getByRole("button", { name: "Cadastrar" }).click();
  await expect(
    page.getByRole("heading", { name: "Visão geral", level: 1 }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Navegação principal" })
    .getByRole("link", { name: "Meu histórico" })
    .click();
}
const card = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });
const sheetOf = (page: Page, name: string) =>
  page.getByRole("dialog", { name: `Detalhes da disciplina ${name}` });

test("on a phone, marking a course takes one tap, shows the period and can be undone", async ({
  page,
}) => {
  await register(page, "mobile-mark");
  await card(page, "Algoritmos").tap();
  const sheet = sheetOf(page, "Algoritmos");
  await expect(sheet).toBeVisible();
  // O foco entra na folha: leitores de tela anunciam a disciplina.
  await expect(
    sheet.getByRole("heading", { name: "Algoritmos" }),
  ).toBeFocused();

  const editor = sheet.getByRole("region", { name: "Situação no histórico" });
  await expect(editor).toContainText("Registrar em 2025.1 · 3º período");
  const approve = editor.getByRole("button", { name: "+ Aprovada" });
  const box = (await approve.boundingBox())!;
  // A ação aparece sem rolar, com alvo de 44 px e nada por cima (a barra de
  // abas ficava sobre a folha e engolia o toque).
  expect(box.y + box.height).toBeLessThanOrEqual(844);
  expect(box.height).toBeGreaterThanOrEqual(44);
  const onTop = await page.evaluate(
    ([x, y]) => !!document.elementFromPoint(x, y)?.closest("#detalhes"),
    [box.x + box.width / 2, box.y + box.height / 2],
  );
  expect(onTop).toBe(true);

  await approve.tap();
  const term = editor
    .getByRole("group", { name: "Tentativa 1" })
    .getByLabel("Semestre");
  await expect(term).toHaveValue("2025.1");
  await expect(term.locator("option:checked")).toHaveText(
    "2025.1 · 3º período",
  );
  await sheet.getByRole("button", { name: "Fechar detalhes" }).tap();

  // Salvar fica à vista, acima da barra de abas, dizendo o que mudou.
  const bar = page.getByRole("region", { name: "Alterações no histórico" });
  await expect(bar).toContainText(
    "Algoritmos: aprovada em 2025.1 · 3º período",
  );
  await expect(bar).toBeInViewport();
  const barBox = (await bar.boundingBox())!;
  const navBox = (await page
    .getByRole("navigation", { name: "Navegação principal" })
    .boundingBox())!;
  expect(barBox.y + barBox.height).toBeLessThanOrEqual(navBox.y + 1);

  await bar.getByRole("button", { name: "Desfazer" }).tap();
  await expect(bar).toHaveCount(0);
  await expect(card(page, "Algoritmos")).not.toHaveAttribute(
    "data-status",
    "completed",
  );
});

test("a semester outside the curriculum period warns that the card changes column", async ({
  page,
}) => {
  await register(page, "mobile-column");
  await card(page, "Algoritmos").tap();
  const editor = sheetOf(page, "Algoritmos").getByRole("region", {
    name: "Situação no histórico",
  });
  await editor.getByRole("button", { name: "+ Aprovada" }).tap();
  await editor
    .getByRole("group", { name: "Tentativa 1" })
    .getByLabel("Semestre")
    .selectOption("2024.1");
  await expect(editor).toContainText(
    "Aparece na coluna do 1º período no mapa, fora do 3º período da matriz.",
  );
  await expect(
    page.getByRole("region", { name: "Alterações no histórico" }),
  ).toContainText("Algoritmos: aprovada em 2024.1 · 1º período");
});

test("a new row in the history form takes the course's period instead of the first", async ({
  page,
}) => {
  await register(page, "mobile-form");
  await page.getByRole("button", { name: "Editar histórico" }).click();
  await page.getByRole("button", { name: "Adicionar cadeira" }).click();
  const term = page.getByLabel("Semestre da tentativa");
  // Antes, toda linha nova nascia no semestre de ingresso (1º período).
  await expect(term).toHaveValue("");
  await page
    .getByRole("combobox", { name: "Disciplina" })
    .selectOption({ label: "Algoritmos" });
  await expect(term).toHaveValue("2025.1");
  const form = page.locator("form").filter({ has: term });
  await expect(form.getByText("3º período", { exact: true })).toBeVisible();
  await term.fill("2024.1");
  await expect(
    form.getByText(
      "1º período · aparece na coluna do 1º período, fora do 3º da matriz.",
    ),
  ).toBeVisible();
});
