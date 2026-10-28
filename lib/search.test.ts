import { describe, expect, it } from "vitest";
import { cardPath, numberFromPath, parseQuery } from "./search";

describe("parseQuery", () => {
  it.each([
    ["sv2a 201/165", { kind: "set_number", set: "sv2a", number: "201", total: "165" }],
    ["SV2A 201/165", { kind: "set_number", set: "sv2a", number: "201", total: "165" }],
    ["  sv2a   201 / 165 ", { kind: "set_number", set: "sv2a", number: "201", total: "165" }],
    ["ｓｖ２ａ　２０１／１６５", { kind: "set_number", set: "sv2a", number: "201", total: "165" }],
    ["sv2a-201", { kind: "set_number", set: "sv2a", number: "201", total: null }],
    ["sv2a#201", { kind: "set_number", set: "sv2a", number: "201", total: null }],
    ["sv2a 001/165", { kind: "set_number", set: "sv2a", number: "1", total: "165" }],
    ["sv-p 012", { kind: "set_number", set: "sv-p", number: "12", total: null }],
    ["s12a TG01/TG30", { kind: "set_number", set: "s12a", number: "TG1", total: "TG30" }],
    ["201/165", { kind: "number", number: "201", total: "165" }],
    ["201", { kind: "number", number: "201", total: null }],
    ["No. 201", { kind: "number", number: "201", total: null }],
    ["#201", { kind: "number", number: "201", total: null }],
    ["리자몽", { kind: "name", text: "리자몽" }],
    ["리자몽 ex", { kind: "name", text: "리자몽 ex" }],
    ["Charizard ex", { kind: "name", text: "Charizard ex" }],
    ["sv2a201/165", { kind: "name", text: "sv2a201/165" }],
    ["   ", { kind: "empty" }],
  ])("%s", (input, expected) => {
    expect(parseQuery(input)).toEqual(expected);
  });
});

describe("card paths", () => {
  it("round-trips the collector number through the URL", () => {
    const path = cardPath("sv2a", "201/165");
    expect(path).toBe("/cards/sv2a/201-165");
    expect(numberFromPath("201-165")).toBe("201/165");
  });

  it("treats a malformed escape as not found instead of throwing", () => {
    expect(numberFromPath("%E0")).toBeNull();
  });
});
