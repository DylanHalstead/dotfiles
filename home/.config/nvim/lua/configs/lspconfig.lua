require("nvchad.configs.lspconfig").defaults()

local nvlsp = require "nvchad.configs.lspconfig"

-- Lua
vim.lsp.config("lua_ls", {
  on_attach = nvlsp.on_attach,
  on_init = nvlsp.on_init,
  capabilities = nvlsp.capabilities,
  settings = {
    Lua = {
      diagnostics = { globals = { "vim" } },
      workspace = {
        library = {
          [vim.fn.expand "$VIMRUNTIME/lua"] = true,
          [vim.fn.expand "$VIMRUNTIME/lua/vim/lsp"] = true,
          [vim.fn.stdpath "data" .. "/lazy/ui/nvchad_types"] = true,
          [vim.fn.stdpath "data" .. "/lazy/lazy.nvim/lua/lazy"] = true,
        },
        maxPreload = 100000,
        preloadFileSize = 10000,
      },
    },
  },
})

-- Go
vim.lsp.config("gopls", {
  on_attach = nvlsp.on_attach,
  on_init = nvlsp.on_init,
  capabilities = nvlsp.capabilities,
  settings = {
    gopls = {
      completeUnimported = true,
      usePlaceholders = true,
      analyses = {
        unusedparams = true,
        unusedwrite = true,
        nilness = true,
        useany = true,
      },
      staticcheck = true,
      gofumpt = true,
    },
  },
})

-- Ruby
vim.lsp.config("ruby_lsp", {
  on_attach = nvlsp.on_attach,
  on_init = nvlsp.on_init,
  capabilities = nvlsp.capabilities,
  init_options = {
    formatter = "none", -- conform handles formatting via rubocop
    linters = { "rubocop" },
  },
})

-- TypeScript / JavaScript
local ts_inlay_hints = {
  parameterNames = { enabled = "literals" },
  parameterTypes = { enabled = true },
  variableTypes = { enabled = true },
  propertyDeclarationTypes = { enabled = true },
  functionLikeReturnTypes = { enabled = true },
  enumMemberValues = { enabled = true },
}

vim.lsp.config("vtsls", {
  on_attach = function(client, bufnr)
    -- oxfmt handles formatting; strip these so conform's lsp_fallback never picks vtsls
    client.server_capabilities.documentFormattingProvider = false
    client.server_capabilities.documentRangeFormattingProvider = false
    nvlsp.on_attach(client, bufnr)
  end,
  on_init = nvlsp.on_init,
  capabilities = nvlsp.capabilities,
  settings = {
    typescript = {
      inlayHints = ts_inlay_hints,
      format = { enable = false }, -- oxfmt handles formatting
      updateImportsOnFileMove = { enabled = "always" },
    },
    javascript = {
      inlayHints = ts_inlay_hints,
      format = { enable = false },
      updateImportsOnFileMove = { enabled = "always" },
    },
  },
})

local oxlint_default_on_attach = vim.lsp.config.oxlint.on_attach
vim.lsp.config("oxlint", {
  on_attach = function(client, bufnr)
    oxlint_default_on_attach(client, bufnr) -- registers :LspOxlintFixAll
    nvlsp.on_attach(client, bufnr)
  end,
  on_init = nvlsp.on_init,
  capabilities = nvlsp.capabilities,
})

-- Python
vim.lsp.config("ruff", {
  on_attach = function(client, bufnr)
    -- defer hover to ty so we don't get "no info" hovers from ruff
    client.server_capabilities.hoverProvider = false
    nvlsp.on_attach(client, bufnr)
  end,
  on_init = nvlsp.on_init,
  capabilities = nvlsp.capabilities,
})

vim.lsp.config("ty", {
  on_attach = nvlsp.on_attach,
  on_init = nvlsp.on_init,
  capabilities = nvlsp.capabilities,
  cmd = { "ty", "server" },
  filetypes = { "python" },
  root_markers = { "pyproject.toml", "ty.toml", "setup.py", "setup.cfg", "requirements.txt", ".git" },
})

local servers = { "lua_ls", "gopls", "ruby_lsp", "vtsls", "oxlint", "ruff", "ty" }
vim.lsp.enable(servers)
