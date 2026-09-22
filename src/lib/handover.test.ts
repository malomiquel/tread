import assert from "node:assert/strict";
import { test } from "node:test";
import {
  handoverFileName, handoverUrl, HANDOVER_TIMEOUT_MS, makeToken, readHandoverUrl, secondsLeft,
} from "./handover.ts";

test("a token is long, lowercase and never the same twice", () => {
  const token = makeToken();
  assert.match(token, /^[a-z0-9]{22}$/);
  const many = new Set(Array.from({ length: 500 }, () => makeToken()));
  assert.equal(many.size, 500);
});

test("the url is the origin, a slash, and the token", () => {
  assert.equal(
    handoverUrl("http://192.168.1.23:51234", "abcdefghij0123456789kl"),
    "http://192.168.1.23:51234/abcdefghij0123456789kl.zip",
  );
  // A trailing slash on the origin must not double up.
  assert.equal(
    handoverUrl("http://192.168.1.23:51234/", "abcdefghij0123456789kl"),
    "http://192.168.1.23:51234/abcdefghij0123456789kl.zip",
  );
  assert.equal(handoverFileName("abc"), "abc.zip");
});

test("our own code is read back", () => {
  const url = handoverUrl("http://192.168.1.23:51234", makeToken());
  assert.equal(readHandoverUrl(url), url);
  // Whitespace from a scanner is not a reason to refuse.
  assert.equal(readHandoverUrl(` ${url}\n`), url);
});

test("every private range a home network uses is accepted", () => {
  for (const host of ["192.168.1.23", "10.0.0.7", "172.16.4.2", "172.31.255.1", "169.254.10.2"]) {
    const url = handoverUrl(`http://${host}:8080`, makeToken());
    assert.equal(readHandoverUrl(url), url, host);
  }
});

test("a code pointing anywhere but this network is refused", () => {
  const token = makeToken();
  // The whole reason this function exists: a QR code is a url somebody else
  // wrote, and scanning a poster must not make the app fetch what it names.
  assert.equal(readHandoverUrl(`http://93.184.216.34:8080/${token}.zip`), null);
  assert.equal(readHandoverUrl(`http://exemple.fr/${token}.zip`), null);
  assert.equal(readHandoverUrl(`https://192.168.1.23:8080/${token}.zip`), null);
  assert.equal(readHandoverUrl(`http://172.32.0.1:8080/${token}.zip`), null);
  assert.equal(readHandoverUrl(`http://11.0.0.1:8080/${token}.zip`), null);
});

test("a code of the wrong shape is refused", () => {
  assert.equal(readHandoverUrl("http://192.168.1.23:8080/"), null);
  assert.equal(readHandoverUrl("http://192.168.1.23:8080/tout.zip"), null);
  assert.equal(readHandoverUrl("http://192.168.1.23:8080/../../etc/passwd"), null);
  assert.equal(readHandoverUrl(`http://192.168.1.23:8080/${makeToken()}.txt`), null);
  assert.equal(readHandoverUrl("bonjour"), null);
  assert.equal(readHandoverUrl(""), null);
});

test("the countdown runs out and stops at zero", () => {
  const started = 1_000_000;
  assert.equal(secondsLeft(started, started), HANDOVER_TIMEOUT_MS / 1000);
  assert.equal(secondsLeft(started, started + 60_000), 60);
  assert.equal(secondsLeft(started, started + HANDOVER_TIMEOUT_MS), 0);
  assert.equal(secondsLeft(started, started + HANDOVER_TIMEOUT_MS + 99_000), 0);
});
