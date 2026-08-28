---@type ChadrcConfig
local M = {}

M.base46 = {
  theme = "chadracula",
  theme_toggle = { "chadracula", "one_light" },
  transparency = false,
}

-- Suppress MasonInstallAll's auto-discovery for tools we install outside Mason.
-- ruff/ty come from `uv tool install`; rubocop comes from `gem install` under mise.
M.mason = {
  -- explicit pkgs for tools NvChad's auto-discovery misses
  pkgs = { "goimports-reviser" },
  -- ruff/ty come from `uv tool install`; rubocop comes from `gem install` under mise
  skip = { "ruff", "rubocop" },
}

return M
