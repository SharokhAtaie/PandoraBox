package config

import (
	"github.com/spf13/cobra"
)

type Config struct {
	ProxyPort int
	APIPort   int
	MCPPort   int
	DBPath    string
}

func FromFlags(cmd *cobra.Command) *Config {
	proxyPort, _ := cmd.Flags().GetInt("proxy-port")
	apiPort, _ := cmd.Flags().GetInt("api-port")
	mcpPort, _ := cmd.Flags().GetInt("mcp-port")
	dbPath, _ := cmd.Flags().GetString("db")
	return &Config{
		ProxyPort: proxyPort,
		APIPort:   apiPort,
		MCPPort:   mcpPort,
		DBPath:    dbPath,
	}
}
