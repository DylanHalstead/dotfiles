return {
  {
    "stevearc/conform.nvim",
    event = "BufWritePre",
    opts = require "configs.conform",
  },

  {
    "neovim/nvim-lspconfig",
    config = function()
      require "configs.lspconfig"
    end,
  },

  {
    "nvim-tree/nvim-tree.lua",
    opts = function(_, opts)
      opts.view = vim.tbl_extend("force", opts.view or {}, {
        side = "right",
        width = 30,
        adaptive_size = false,
        preserve_window_proportions = true,
      })
      opts.sync_root_with_cwd = true
      opts.update_focused_file = { enable = true, update_root = false }
      opts.git = { enable = true, ignore = false }
      opts.filesystem_watchers = { enable = true }
      opts.actions = { open_file = { resize_window = true } }
      opts.renderer = vim.tbl_deep_extend("force", opts.renderer or {}, {
        icons = {
          glyphs = {
            git = {
              unstaged  = "M",
              staged    = "S",
              unmerged  = "U",
              renamed   = "R",
              untracked = "?",
              deleted   = "D",
              ignored   = "◌",
            },
          },
        },
      })
    end,
  },

  {
    "folke/trouble.nvim",
    cmd = "Trouble",
    opts = {},
    keys = {
      { "<leader>dd", "<cmd>Trouble diagnostics toggle<cr>", desc = "Diagnostics (Trouble)" },
      { "<leader>db", "<cmd>Trouble diagnostics toggle filter.buf=0<cr>", desc = "Buffer diagnostics (Trouble)" },
      { "<leader>ds", "<cmd>Trouble symbols toggle focus=false<cr>", desc = "Symbols (Trouble)" },
      { "<leader>dr", "<cmd>Trouble lsp toggle focus=false win.position=right<cr>", desc = "LSP refs/defs (Trouble)" },
      { "<leader>dl", "<cmd>Trouble loclist toggle<cr>", desc = "Loclist (Trouble)" },
      { "<leader>dq", "<cmd>Trouble qflist toggle<cr>", desc = "Quickfix (Trouble)" },
    },
  },

  {
    "nvim-neotest/neotest",
    dependencies = {
      "nvim-neotest/nvim-nio",
      "nvim-lua/plenary.nvim",
      "nvim-treesitter/nvim-treesitter",
      "olimorris/neotest-rspec",
      "fredrikaverpil/neotest-golang",
      "nvim-neotest/neotest-python",
      "marilari88/neotest-vitest",
    },
    keys = {
      { "<leader>tn", function() require("neotest").run.run() end, desc = "Run nearest test" },
      { "<leader>tf", function() require("neotest").run.run(vim.fn.expand "%") end, desc = "Run file" },
      { "<leader>ts", function() require("neotest").run.run { suite = true } end, desc = "Run suite" },
      { "<leader>tr", function() require("neotest").run.run_last() end, desc = "Run last" },
      { "<leader>tw", function() require("neotest").watch.toggle() end, desc = "Watch toggle" },
      { "<leader>to", function() require("neotest").output.open { enter = true, auto_close = true } end, desc = "Output float" },
      { "<leader>tO", function() require("neotest").output_panel.toggle() end, desc = "Output panel" },
      { "<leader>tS", function() require("neotest").summary.toggle() end, desc = "Summary panel" },
      { "[t", function() require("neotest").jump.prev { status = "failed" } end, desc = "Prev failed test" },
      { "]t", function() require("neotest").jump.next { status = "failed" } end, desc = "Next failed test" },
    },
    config = function()
      require("neotest").setup {
        adapters = {
          require "neotest-rspec",
          require "neotest-golang",
          require "neotest-python",
          require "neotest-vitest",
        },
        output = { open_on_run = true },
      }
    end,
  },
}
