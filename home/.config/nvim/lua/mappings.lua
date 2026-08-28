require "nvchad.mappings"

local map = vim.keymap.set

-- wrap-line aware vertical movement (preserves count, skips operator-pending)
local function wrap_aware(key)
  return 'v:count || mode(1)[0:1] == "no" ? "' .. key .. '" : "g' .. key .. '"'
end

map({ "n", "v" }, "j", wrap_aware "j", { expr = true, desc = "Move down (wrap-aware)" })
map({ "n", "v" }, "k", wrap_aware "k", { expr = true, desc = "Move up (wrap-aware)" })
map({ "n", "v" }, "<Down>", wrap_aware "j", { expr = true, desc = "Move down (wrap-aware)" })
map({ "n", "v" }, "<Up>", wrap_aware "k", { expr = true, desc = "Move up (wrap-aware)" })
map("x", "j", wrap_aware "j", { expr = true, desc = "Move down (wrap-aware)" })
map("x", "k", wrap_aware "k", { expr = true, desc = "Move up (wrap-aware)" })

-- keep selection after indenting
map("v", "<", "<gv", { desc = "Indent line" })
map("v", ">", ">gv", { desc = "Indent line" })

-- don't yank replaced text when pasting over a selection
map("x", "p", 'p:let @+=@0<CR>:let @"=@0<CR>', { silent = true, desc = "Paste without yanking" })

-- diagnostics with rounded float border (uses modern jump API)
map("n", "[d", function()
  vim.diagnostic.jump { count = -1, float = { border = "rounded" } }
end, { desc = "Prev diagnostic" })

map("n", "]d", function()
  vim.diagnostic.jump { count = 1, float = { border = "rounded" } }
end, { desc = "Next diagnostic" })

map("n", "<leader>lf", function()
  vim.diagnostic.open_float { border = "rounded" }
end, { desc = "Floating diagnostic" })

-- write a read-only file as sudo
vim.api.nvim_create_user_command("SudoWrite", function()
  vim.cmd "silent! write !sudo tee > /dev/null %"
  vim.cmd "edit!"
end, { desc = "Write current file with sudo" })
vim.cmd "cnoreabbrev w!! SudoWrite"

-- visual <C-r>: substitute over the buffer using the selected text
map("v", "<C-r>", '"hy:%s/<C-r>h//gc<left><left><left>', { desc = "Substitute selection across buffer" })

map("n", "<leader>rn", require "nvchad.lsp.renamer", { desc = "LSP rename" })
