require "nvchad.options"

local o = vim.opt

o.number = true
o.relativenumber = true

-- show ~ at end-of-buffer (NvChad hides it with a space by default)
o.fillchars = { eob = "~" }

-- auto-reload buffers when files change on disk
o.autoread = true

-- prompt on quit/switch with unsaved changes instead of erroring
o.confirm = true

-- visualize whitespace
o.list = true
o.listchars = { tab = "» ", trail = "·", extends = "›", precedes = "‹", nbsp = "␣" }
