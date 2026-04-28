/**
 * Classic worker: loads solc from CDN and compiles. Catches all errors (including .apply) and never throws.
 */
var SOLC_CDN = "https://binaries.soliditylang.org/bin/soljson-v0.8.20+commit.a1b79de6.js";
var CONTRACT_NAME = "ERC20Token";

function postError(msg) {
  try {
    self.postMessage({ abi: "", bytecode: "", errors: [msg] });
  } catch (_) {}
}

self.onerror = function (message, source, lineno, colno, error) {
  postError("Compiler error. Try: Chrome (latest), disable extensions, disable Translate for this page. " + (error && error.message ? error.message : message));
  return true;
};

self.Module = self.Module || {};
self.Module.onRuntimeInitialized = function () {
  self._solcReady = true;
};

try {
  importScripts(SOLC_CDN);
} catch (err) {
  postError("Failed to load compiler. Check internet. " + (err.message || String(err)));
}

function waitReady(callback, timeoutMs) {
  timeoutMs = timeoutMs || 90000;
  if (self.Module && typeof self.Module.cwrap === "function") {
    try {
      callback();
    } catch (err) {
      postError(err && err.message ? err.message : String(err));
    }
    return;
  }
  var start = Date.now();
  var t = setInterval(function () {
    if (self.Module && typeof self.Module.cwrap === "function") {
      clearInterval(t);
      try {
        callback();
      } catch (err) {
        postError(err && err.message ? err.message : String(err));
      }
      return;
    }
    if (Date.now() - start > timeoutMs) {
      clearInterval(t);
      postError("Compiler timed out. Check internet and try again.");
    }
  }, 200);
}

self.onmessage = function (e) {
  var inputStr = e.data && e.data.input;
  if (!inputStr || typeof inputStr !== "string") {
    postError("Missing input.");
    return;
  }

  waitReady(function () {
    var M = self.Module;
    if (!M || typeof M.cwrap !== "function") {
      postError("Compiler not ready. Check internet, disable Chrome Translate for this page.");
      return;
    }
    var compileStandard;
    try {
      compileStandard = M.cwrap("compileStandard", "string", ["string", "number"]);
    } catch (err) {
      postError("Compiler init failed. " + (err && err.message ? err.message : String(err)));
      return;
    }
    if (typeof compileStandard !== "function") {
      postError("Compiler not ready.");
      return;
    }
    var runCompile = function () {
      var out;
      try {
        out = compileStandard(inputStr, 0);
      } catch (err) {
        var msg = err && err.message ? err.message : String(err);
        if (msg.indexOf("apply") !== -1) {
          postError("Browser compiler error. Use latest Chrome, disable Translate for this page, then try again.");
        } else {
          postError(msg);
        }
        return;
      }
      try {
        var output = JSON.parse(out || "{}");
        var err = [];
        if (output.errors) {
          for (var i = 0; i < output.errors.length; i++) {
            var el = output.errors[i];
            if (el.severity === "error") err.push(el.formattedMessage || el.message);
          }
        }
        var contract = output.contracts && output.contracts["ERC20Token.sol"] && output.contracts["ERC20Token.sol"][CONTRACT_NAME];
        if (!contract) {
          postError(err.length ? err.join(" ") : "Compilation failed.");
          return;
        }
        var bc = (contract.evm && contract.evm.bytecode && contract.evm.bytecode.object) ? contract.evm.bytecode.object : "";
        self.postMessage({
          abi: JSON.stringify(contract.abi || []),
          bytecode: typeof bc === "string" ? bc : "",
          errors: err.length ? err : undefined,
        });
      } catch (err) {
        postError(err && err.message ? err.message : String(err));
      }
    };
    runCompile();
  });
};
