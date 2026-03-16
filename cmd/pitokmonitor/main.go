package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/hamedsj5/pitokmonitor/internal/api"
	"github.com/hamedsj5/pitokmonitor/internal/ca"
	"github.com/hamedsj5/pitokmonitor/internal/config"
	"github.com/hamedsj5/pitokmonitor/internal/events"
	mcpsrv "github.com/hamedsj5/pitokmonitor/internal/mcp"
	"github.com/hamedsj5/pitokmonitor/internal/proxy"
	"github.com/hamedsj5/pitokmonitor/internal/storage"
	"github.com/spf13/cobra"
)

func main() {
	root := &cobra.Command{
		Use:   "pitokmonitor",
		Short: "MITM proxy with AI/MCP integration",
	}

	serveCmd := &cobra.Command{
		Use:   "serve",
		Short: "Start the proxy and web UI",
		RunE:  runServe,
	}

	caCmd := &cobra.Command{
		Use:   "ca",
		Short: "CA management",
	}
	caExportCmd := &cobra.Command{
		Use:   "export",
		Short: "Print CA certificate PEM to stdout",
		RunE:  runCAExport,
	}
	caRegenCmd := &cobra.Command{
		Use:   "regenerate",
		Short: "Delete and regenerate the CA (re-install in browser after this)",
		RunE: func(cmd *cobra.Command, args []string) error {
			authority, err := ca.Regenerate()
			if err != nil {
				return err
			}
			fmt.Println("New CA generated. Re-download and re-install it in your browser.")
			fmt.Print(authority.CertPEM())
			return nil
		},
	}
	caCmd.AddCommand(caExportCmd, caRegenCmd)

	serveCmd.Flags().Int("proxy-port", 8080, "Proxy port")
	serveCmd.Flags().Int("api-port", 7777, "API/UI port")
	serveCmd.Flags().Int("mcp-port", 9090, "MCP SSE port")
	serveCmd.Flags().String("db", "pitok.db", "SQLite database path")

	root.AddCommand(serveCmd, caCmd)

	if err := root.Execute(); err != nil {
		os.Exit(1)
	}
}

func runServe(cmd *cobra.Command, args []string) error {
	cfg := config.FromFlags(cmd)

	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	// Storage
	db, err := storage.Open(cfg.DBPath)
	if err != nil {
		return fmt.Errorf("open db: %w", err)
	}
	defer db.Close()

	// CA
	authority, err := ca.Load()
	if err != nil {
		return fmt.Errorf("load CA: %w", err)
	}

	// Event bus
	bus := events.NewBus()

	// Intercept queue
	interceptQueue := proxy.NewInterceptQueue()

	// Proxy engine
	proxyEngine := proxy.New(cfg, db, authority, bus, interceptQueue)

	// API server
	apiServer := api.NewServer(cfg, db, bus, proxyEngine, interceptQueue, authority)
	apiServer.SetStaticFS(getUIFS())

	// MCP server
	mcpServer := mcpsrv.NewServer(cfg, db, proxyEngine, interceptQueue, authority)

	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	// Start API server
	go func() {
		addr := fmt.Sprintf(":%d", cfg.APIPort)
		slog.Info("API server starting", "addr", addr)
		srv := &http.Server{Addr: addr, Handler: apiServer.Handler()}
		go func() {
			<-ctx.Done()
			srv.Shutdown(context.Background())
		}()
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("API server error", "err", err)
		}
	}()

	// Start MCP server
	go func() {
		slog.Info("MCP server starting", "port", cfg.MCPPort)
		if err := mcpServer.Start(ctx); err != nil {
			slog.Error("MCP server error", "err", err)
		}
	}()

	// Start proxy (blocking until ctx done)
	slog.Info("Proxy starting", "port", cfg.ProxyPort)
	return proxyEngine.Start(ctx)
}

func runCAExport(cmd *cobra.Command, args []string) error {
	authority, err := ca.Load()
	if err != nil {
		return err
	}
	fmt.Print(authority.CertPEM())
	return nil
}
