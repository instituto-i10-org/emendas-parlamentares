import { describe, expect, it } from "vitest";
import { DATA, DATA_HORA } from "../texto";

// O servidor roda em UTC; a exibição é sempre no horário de Brasília.
describe("data e hora de registro", () => {
  it("depois das 21h de Brasília o dia não vira", () => {
    const d = new Date("2026-10-25T00:30:00Z"); // 24/10, 21h30 em Brasília
    expect(DATA(d)).toBe("24/10/2026");
    expect(DATA_HORA(d)).toBe("24/10/2026, 21:30:00");
  });

  it("sem data, mostra travessão", () => {
    expect(DATA(null)).toBe("—");
    expect(DATA_HORA(undefined)).toBe("—");
  });
});
