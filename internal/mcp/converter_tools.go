package mcp

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/hamedsj5/pandorabox/internal/converter"
	proj "github.com/hamedsj5/pandorabox/internal/project"
	"github.com/mark3labs/mcp-go/mcp"
)

func (s *Server) registerConverterTools() {
	s.mcp.AddTool(mcp.NewTool("converter_list_algorithms",
		mcp.WithDescription("List available converter/encoder/hash algorithms"),
	), s.toolConverterListAlgorithms)

	s.mcp.AddTool(mcp.NewTool("converter_transform",
		mcp.WithDescription("Transform input text using one algorithm"),
		mcp.WithString("input", mcp.Description("Input text"), mcp.Required()),
		mcp.WithString("algorithm", mcp.Description("Algorithm ID, e.g. base64_decode, sha256"), mcp.Required()),
	), s.toolConverterTransform)

	s.mcp.AddTool(mcp.NewTool("converter_get_stacks",
		mcp.WithDescription("Get saved conversion stacks from project config"),
	), s.toolConverterGetStacks)

	s.mcp.AddTool(mcp.NewTool("converter_save_stacks",
		mcp.WithDescription("Replace saved conversion stacks in project config"),
		mcp.WithString("stacks_json", mcp.Description("JSON array of ConvertStack objects"), mcp.Required()),
	), s.toolConverterSaveStacks)

	s.mcp.AddTool(mcp.NewTool("converter_run_stack",
		mcp.WithDescription("Run a saved stack by id or ad-hoc stack JSON on input text"),
		mcp.WithString("input", mcp.Description("Input text"), mcp.Required()),
		mcp.WithString("stack_id", mcp.Description("Saved stack id")),
		mcp.WithString("stack_json", mcp.Description("Ad-hoc ConvertStack JSON")),
	), s.toolConverterRunStack)
}

func (s *Server) toolConverterListAlgorithms(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	if !s.mcpEnabled() {
		return nil, fmt.Errorf("MCP access is disabled for this project")
	}
	return jsonResult(map[string]interface{}{"algorithms": converter.Algorithms()})
}

func (s *Server) toolConverterTransform(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	if !s.mcpEnabled() {
		return nil, fmt.Errorf("MCP access is disabled for this project")
	}
	input, _ := req.Params.Arguments["input"].(string)
	algorithm, _ := req.Params.Arguments["algorithm"].(string)
	if algorithm == "" {
		return nil, fmt.Errorf("algorithm required")
	}
	out, err := converter.Transform(input, algorithm)
	if err != nil {
		return nil, err
	}
	return jsonResult(map[string]interface{}{"output": out})
}

func (s *Server) toolConverterGetStacks(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	if !s.mcpEnabled() {
		return nil, fmt.Errorf("MCP access is disabled for this project")
	}
	p := s.getProject()
	if p == nil {
		return nil, fmt.Errorf("no project loaded")
	}
	cfg := p.Config()
	return jsonResult(map[string]interface{}{
		"converter": map[string]interface{}{
			"stacks": normalizeMCPConverterConfig(cfg.Converter).Stacks,
		},
	})
}

func (s *Server) toolConverterSaveStacks(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	if !s.mcpEnabled() {
		return nil, fmt.Errorf("MCP access is disabled for this project")
	}
	p := s.getProject()
	if p == nil {
		return nil, fmt.Errorf("no project loaded")
	}
	raw, _ := req.Params.Arguments["stacks_json"].(string)
	if raw == "" {
		return nil, fmt.Errorf("stacks_json required")
	}
	var stacks []proj.ConvertStack
	if err := json.Unmarshal([]byte(raw), &stacks); err != nil {
		return nil, fmt.Errorf("stacks_json: %w", err)
	}
	cfg := p.Config()
	cfg.Converter = normalizeMCPConverterConfig(proj.ConverterConfig{Stacks: stacks})
	if err := p.Save(cfg); err != nil {
		return nil, err
	}
	return jsonResult(map[string]interface{}{
		"converter": cfg.Converter,
	})
}

func (s *Server) toolConverterRunStack(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	if !s.mcpEnabled() {
		return nil, fmt.Errorf("MCP access is disabled for this project")
	}
	input, _ := req.Params.Arguments["input"].(string)
	stackID, _ := req.Params.Arguments["stack_id"].(string)
	stackJSON, _ := req.Params.Arguments["stack_json"].(string)

	var stack *proj.ConvertStack
	if stackJSON != "" {
		var parsed proj.ConvertStack
		if err := json.Unmarshal([]byte(stackJSON), &parsed); err != nil {
			return nil, fmt.Errorf("stack_json: %w", err)
		}
		sn := normalizeMCPStack(parsed)
		stack = &sn
	} else {
		if stackID == "" {
			return nil, fmt.Errorf("stack_id or stack_json required")
		}
		p := s.getProject()
		if p == nil {
			return nil, fmt.Errorf("no project loaded")
		}
		for _, s := range normalizeMCPConverterConfig(p.Config().Converter).Stacks {
			if s.ID == stackID {
				cp := s
				stack = &cp
				break
			}
		}
	}

	if stack == nil {
		return nil, fmt.Errorf("stack not found")
	}

	cur := input
	for _, step := range stack.Steps {
		if !step.Enabled {
			continue
		}
		out, err := converter.Transform(cur, step.Algorithm)
		if err != nil {
			return nil, fmt.Errorf("step %s failed: %w", step.ID, err)
		}
		cur = out
	}
	return jsonResult(map[string]interface{}{
		"stack":  stack,
		"output": cur,
	})
}

func normalizeMCPConverterConfig(in proj.ConverterConfig) proj.ConverterConfig {
	out := proj.ConverterConfig{Stacks: make([]proj.ConvertStack, 0, len(in.Stacks))}
	for _, s := range in.Stacks {
		out.Stacks = append(out.Stacks, normalizeMCPStack(s))
	}
	return out
}

func normalizeMCPStack(s proj.ConvertStack) proj.ConvertStack {
	if s.ID == "" {
		s.ID = uuid.NewString()
	}
	if s.Name == "" {
		s.Name = "New Stack"
	}
	if s.Steps == nil {
		s.Steps = []proj.ConvertStep{}
	}
	for i := range s.Steps {
		if s.Steps[i].ID == "" {
			s.Steps[i].ID = uuid.NewString()
		}
		if s.Steps[i].Algorithm == "" {
			s.Steps[i].Algorithm = "base64_decode"
		}
	}
	return s
}
