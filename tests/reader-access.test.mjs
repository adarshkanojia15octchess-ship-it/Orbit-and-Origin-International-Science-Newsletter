import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/account/page.tsx", import.meta.url), "utf8");

test("reader access page keeps every authentication action wired", () => {
  for (const action of ["signInReader", "signInReaderWithGoogle", "signUpReader", "signOutReader"]) {
    assert.match(page, new RegExp("action=\\{" + action + "\\}"));
  }
});

test("reader credentials retain accessible labels and password-manager hints", () => {
  for (const id of ["reader-signin-email", "reader-signin-password", "reader-signup-email", "reader-signup-password"]) {
    assert.match(page, new RegExp('id="' + id + '"'));
  }
  assert.match(page, /autoComplete="current-password"/);
  assert.match(page, /autoComplete="new-password"/);
  assert.match(page, /autoCapitalize="none"/);
});

test("reader access remains optional and the publication remains open", () => {
  assert.match(page, /Continue reading as a guest/);
  assert.match(page, /remains open to everyone/);
  assert.match(page, /cannot create, edit, schedule or publish articles or issues/);
});

test("sign-in feedback has accessible live-region semantics", () => {
  assert.match(page, /role="alert"/);
  assert.match(page, /role="status"/);
  assert.match(page, /check-email/);
});
