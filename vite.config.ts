import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// 本地化硬性约束：base './' 使产物可用任意本地 HTTP 服务器打开
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    open: false,
    watch: {
      // 使用轮询模式监听文件变化：在部分文件系统（网络盘、容器挂载、
      // 原子写入工具链）上文件系统事件不可靠，轮询可避免 watch 崩溃（EBUSY）。
      usePolling: true,
      interval: 300,
    },
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 6000,
    // kekule/RDKit 体积较大，关闭 gzip 大小告警干扰
    reportCompressedSize: false,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
