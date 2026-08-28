local options = {
  formatters_by_ft = {
    lua = { "stylua" },
    go = { "goimports_reviser", "gofmt", "golines" },
    ruby = { "rubocop" },
    javascript = { "oxfmt" },
    javascriptreact = { "oxfmt" },
    typescript = { "oxfmt" },
    typescriptreact = { "oxfmt" },
    json = { "oxfmt" },
    jsonc = { "oxfmt" },
    css = { "oxfmt" },
    python = { "ruff_organize_imports", "ruff_format" },
  },

  format_on_save = {
    timeout_ms = 2000,
    lsp_format = "fallback",
  },
}

return options
