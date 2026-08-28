require "nvchad.autocmds"

local autocmd = vim.api.nvim_create_autocmd

-- auto-open nvim-tree on startup
autocmd("VimEnter", {
  callback = function()
    require("nvim-tree.api").tree.open()
  end,
})

-- check for external file changes more aggressively so buffers reload
-- when external tools edit them on disk
autocmd({ "FocusGained", "BufEnter", "CursorHold", "CursorHoldI", "TermLeave" }, {
  group = vim.api.nvim_create_augroup("AutoReloadFiles", { clear = true }),
  callback = function()
    if vim.fn.mode() ~= "c" and vim.fn.getcmdwintype() == "" then
      vim.cmd "checktime"
    end
  end,
})

autocmd("FileChangedShellPost", {
  group = vim.api.nvim_create_augroup("AutoReloadNotify", { clear = true }),
  callback = function()
    vim.notify("File changed on disk — buffer reloaded", vim.log.levels.INFO)
  end,
})

-- remember folds and cursor position across sessions for real files
vim.opt.viewoptions:remove "curdir"
local view_group = vim.api.nvim_create_augroup("RememberView", { clear = true })

autocmd("BufWinLeave", {
  group = view_group,
  pattern = "*.*",
  callback = function()
    if vim.bo.buftype == "" then
      pcall(vim.cmd, "mkview")
    end
  end,
})

autocmd("BufWinEnter", {
  group = view_group,
  pattern = "*.*",
  callback = function()
    if vim.bo.buftype == "" then
      pcall(vim.cmd, "silent! loadview")
    end
  end,
})
