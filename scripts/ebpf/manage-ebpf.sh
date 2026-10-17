#!/usr/bin/env bash
# ==============================================================================
# OTT Platform - eBPF Performance & Kernel Observability Management CLI
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GREEN="\033[1;32m"
YELLOW="\033[1;33m"
CYAN="\033[1;36m"
RED="\033[1;31m"
RESET="\033[0m"

header() {
  echo -e "${CYAN}================================================================${RESET}"
  echo -e "${CYAN}   OTT Platform - eBPF Kernel Observability Engine              ${RESET}"
  echo -e "${CYAN}================================================================${RESET}"
}

check_prereqs() {
  echo -e "${YELLOW}[*] Checking Kernel and eBPF System Environment...${RESET}"
  
  # 1. Kernel Version
  KERNEL_VER=$(uname -r)
  echo -e "  - Linux Kernel: ${GREEN}${KERNEL_VER}${RESET}"

  # 2. BTF Support
  if [ -f /sys/kernel/btf/vmlinux ]; then
    echo -e "  - BTF (BPF Type Format): ${GREEN}Available (/sys/kernel/btf/vmlinux)${RESET}"
  else
    echo -e "  - BTF (BPF Type Format): ${RED}Not found${RESET}"
  fi

  # 3. BPF Filesystem
  if mount | grep -q "/sys/fs/bpf"; then
    echo -e "  - BPF Filesystem: ${GREEN}Mounted (/sys/fs/bpf)${RESET}"
  else
    echo -e "  - BPF Filesystem: ${YELLOW}Not mounted at /sys/fs/bpf${RESET}"
  fi

  # 4. Required CLI Tools
  echo -e "\n${YELLOW}[*] Checking eBPF User-Space Tooling...${RESET}"
  for tool in bpftrace bpftool; do
    if command -v $tool >/dev/null 2>&1; then
      echo -e "  - $tool: ${GREEN}Installed ($(command -v $tool))${RESET}"
    else
      echo -e "  - $tool: ${RED}Not Installed${RESET}"
    fi
  done
  if [ -d "/usr/share/bcc/tools" ]; then
    echo -e "  - bcc-tools: ${GREEN}Installed (/usr/share/bcc/tools)${RESET}"
  else
    echo -e "  - bcc-tools: ${RED}Not Installed${RESET}"
  fi
  echo ""
}

install_tools() {
  echo -e "${YELLOW}[*] Installing eBPF Toolchain (bpftrace, bpftool, bcc)...${RESET}"
  if command -v dnf >/dev/null 2>&1; then
    sudo dnf install -y bpftrace bpftool bcc-tools || true
    echo -e "${GREEN}[✓] eBPF packages installation completed.${RESET}"
  else
    echo -e "${RED}[✗] Package manager 'dnf' not found. Please install bpftrace manually.${RESET}"
  fi
}

run_trace_io() {
  header
  echo -e "${GREEN}[*] Starting Block I/O & Video Storage Latency Tracer...${RESET}"
  sudo bpftrace "${SCRIPT_DIR}/trace-video-io.bt"
}

run_trace_hls() {
  header
  echo -e "${GREEN}[*] Starting TCP & HLS Streaming Latency Tracer...${RESET}"
  sudo bpftrace "${SCRIPT_DIR}/trace-hls-latency.bt"
}

run_trace_cpu() {
  header
  echo -e "${GREEN}[*] Starting Container & CPU Scheduler Tracer...${RESET}"
  sudo bpftrace "${SCRIPT_DIR}/trace-container-cpu.bt"
}

run_trace_drops() {
  header
  echo -e "${GREEN}[*] Starting Service-to-Service & Kernel Packet Drop Tracer...${RESET}"
  sudo bpftrace "${SCRIPT_DIR}/trace-packet-drops.bt"
}

show_status() {
  header
  echo -e "${YELLOW}[*] Loaded eBPF Programs in Kernel:${RESET}"
  if command -v bpftool >/dev/null 2>&1; then
    sudo bpftool prog list || true
  else
    echo -e "${RED}bpftool is not installed. Run: $0 install${RESET}"
  fi
}

show_help() {
  header
  echo -e "Usage: $0 [command]\n"
  echo -e "Available Commands:"
  echo -e "  ${GREEN}check${RESET}        Check host kernel eBPF capabilities and tool prerequisites"
  echo -e "  ${GREEN}install${RESET}      Install bpftrace, bpftool, and BCC tools on host via dnf"
  echo -e "  ${GREEN}trace-drops${RESET}  Trace kernel packet drops, dropped SKBs, and inter-service loss"
  echo -e "  ${GREEN}trace-io${RESET}     Trace disk read/write latency and IOPS on /videos_data during encoding"
  echo -e "  ${GREEN}trace-hls${RESET}    Trace TCP latency, client connections, and retransmits for HLS video"
  echo -e "  ${GREEN}trace-cpu${RESET}    Trace scheduler context switches and on-CPU compute time per process"
  echo -e "  ${GREEN}status${RESET}       List all currently active eBPF programs in the Linux kernel"
  echo -e "  ${GREEN}help${RESET}         Display this help message\n"
}

case "$1" in
  check)
    check_prereqs
    ;;
  install)
    install_tools
    ;;
  trace-drops)
    run_trace_drops
    ;;
  trace-io)
    run_trace_io
    ;;
  trace-hls)
    run_trace_hls
    ;;
  trace-cpu)
    run_trace_cpu
    ;;
  status)
    show_status
    ;;
  help|--help|-h|"")
    show_help
    ;;
  *)
    echo -e "${RED}Unknown command: $1${RESET}\n"
    show_help
    exit 1
    ;;
esac
