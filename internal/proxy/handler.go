package proxy

import (
	"bufio"
	"fmt"
	"log/slog"
	"net"
	"net/http"
)

func (p *Proxy) handleConn(conn net.Conn) {
	defer conn.Close()

	br := bufio.NewReader(conn)
	req, err := http.ReadRequest(br)
	if err != nil {
		return
	}

	if req.Method == http.MethodConnect {
		p.handleCONNECT(conn, br, req)
	} else {
		p.handleHTTP(conn, br, req)
	}
}

func (p *Proxy) handleHTTP(conn net.Conn, br *bufio.Reader, req *http.Request) {
	if req.URL.Host == "" {
		req.URL.Host = req.Host
	}
	if req.URL.Scheme == "" {
		req.URL.Scheme = "http"
	}

	slog.Debug("HTTP request", "method", req.Method, "host", req.Host, "path", req.URL.Path)

	resp, _, err := p.roundTrip(req, "http")
	if err != nil {
		fmt.Fprintf(conn, "HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\n\r\n")
		return
	}
	defer resp.Body.Close()
	resp.Write(conn)
}
