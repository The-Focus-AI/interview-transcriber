# Migration Guide: npm to pnpm

This project now uses pnpm as its package manager for better performance and disk space efficiency.

## Why pnpm?

- **Faster installations**: pnpm is up to 2x faster than npm
- **Disk space efficient**: pnpm uses a content-addressable storage, saving gigabytes of disk space
- **Stricter package resolution**: Helps prevent "works on my machine" issues
- **Better monorepo support**: If the project grows

## Migration Steps

### 1. Install pnpm

```bash
npm install -g pnpm
```

### 2. Clean existing installation

```bash
# Remove node_modules and package-lock.json
rm -rf node_modules package-lock.json
```

### 3. Install with pnpm

```bash
pnpm install
```

## Command Mapping

| npm command | pnpm equivalent |
|-------------|-----------------|
| `npm install` | `pnpm install` |
| `npm install <pkg>` | `pnpm add <pkg>` |
| `npm install -D <pkg>` | `pnpm add -D <pkg>` |
| `npm install -g <pkg>` | `pnpm add -g <pkg>` |
| `npm uninstall <pkg>` | `pnpm remove <pkg>` |
| `npm run <script>` | `pnpm <script>` or `pnpm run <script>` |
| `npm test` | `pnpm test` |
| `npm run build` | `pnpm build` |

## Common Commands for This Project

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm dev <url>

# Build the project
pnpm build

# Run tests
pnpm test

# Clean temporary files
pnpm clean
```

## Troubleshooting

### "command not found: pnpm"
Make sure pnpm is installed globally:
```bash
npm install -g pnpm
```

### Permission errors
If you get permission errors, you might need to configure npm's global directory:
```bash
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
npm install -g pnpm
```

### Lockfile conflicts
If you're working in a team, make sure everyone switches to pnpm:
- Delete `package-lock.json`
- Commit `pnpm-lock.yaml` instead
- Update CI/CD pipelines to use pnpm

## CI/CD Updates

If you're using GitHub Actions or other CI/CD:

```yaml
# Example GitHub Actions update
- name: Install pnpm
  uses: pnpm/action-setup@v2
  with:
    version: 8

- name: Install dependencies
  run: pnpm install

- name: Build
  run: pnpm build
```

## Additional Resources

- [pnpm Documentation](https://pnpm.io/)
- [pnpm vs npm comparison](https://pnpm.io/benchmarks)
- [pnpm FAQ](https://pnpm.io/faq)