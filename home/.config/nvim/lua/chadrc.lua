---@type ChadrcConfig
local M = {}

M.base46 = {
  theme = "chadracula",
  theme_toggle = { "chadracula", "one_light" },
  transparency = false,
}

-- Suppress MasonInstallAll's auto-discovery for tools we install outside Mason.
-- mise owns ruff/ty; rubocop comes from `gem install` under mise.
M.mason = {
  -- explicit pkgs for tools NvChad's auto-discovery misses
  pkgs = { "goimports-reviser" },
  skip = { "ruff", "ty", "rubocop" },
}

return M
