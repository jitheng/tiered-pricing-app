# Git Workflow and Branching Strategy

This document describes the Git branching strategy for the Tiered Pricing Shopify app.

---

## Branch Structure

We follow a **three-tier branching strategy**:

```
dev (development) → staging (pre-production) → prod (production)
```

### Branch Descriptions

| Branch | Purpose | Environment | Auto-Deploy |
|--------|---------|-------------|-------------|
| **dev** | Active development, feature integration | Development/Local | No |
| **staging** | Pre-production testing, QA | Staging (Vercel Preview) | Yes (optional) |
| **prod** | Production-ready code | Production (Vercel) | Yes |
| **main** | Mirror of prod (GitHub default) | Archive/Documentation | No |

---

## Workflow

### 1. Development Workflow

All new features and bug fixes start on the **dev** branch:

```bash
# Switch to dev branch
git checkout dev

# Create a feature branch (optional for larger features)
git checkout -b feature/tier-rule-improvements

# Make changes, then commit
git add .
git commit -m "Add tier rule validation"

# Merge back to dev
git checkout dev
git merge feature/tier-rule-improvements

# Push to remote
git push origin dev
```

### 2. Staging Workflow

When dev is stable and ready for testing:

```bash
# Switch to staging
git checkout staging

# Merge dev into staging
git merge dev

# Push to remote (triggers staging deployment)
git push origin staging
```

**Testing on Staging:**
- Install app on staging dev store
- Test all new features
- Run smoke tests
- Verify discounts work correctly

### 3. Production Workflow

When staging is tested and approved:

```bash
# Switch to prod
git checkout prod

# Merge staging into prod
git merge staging

# Tag the release (optional but recommended)
git tag -a v1.0.0 -m "Release v1.0.0: Initial tiered pricing app"

# Push to remote (triggers production deployment)
git push origin prod --tags
```

**After Production Deploy:**
- Merge prod back to main to keep it in sync:
```bash
git checkout main
git merge prod
git push origin main
```

---

## Current Status

Your repository has been configured with all branches, but **authentication is required** to push to GitHub.

### Ready to Push

All branches are created locally with your code:
- ✅ **dev** - Contains all tiered pricing features
- ✅ **staging** - Ready for staging testing
- ✅ **prod** - Ready for production deployment
- ✅ **main** - Merged with dev

### Next Steps: Push to GitHub

You need to authenticate with GitHub to push your code. Choose one of the following methods:

---

## Pushing to GitHub (Manual Steps)

### Option 1: GitHub CLI (Recommended)

```bash
# Install GitHub CLI if not already installed
brew install gh

# Authenticate
gh auth login

# Push all branches
cd "/Users/dixita/Desktop/TestApp/Tiered Pricing/tiered-pricing"
git push -u origin main
git push -u origin dev
git push -u origin staging
git push -u origin prod
```

### Option 2: Personal Access Token (PAT)

1. **Generate a Personal Access Token:**
   - Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Click **Generate new token (classic)**
   - Scopes: Select `repo` (full control of private repositories)
   - Click **Generate token**
   - **Copy the token** (you won't see it again!)

2. **Update Git remote with PAT:**
   ```bash
   cd "/Users/dixita/Desktop/TestApp/Tiered Pricing/tiered-pricing"

   # Update remote URL with your username and PAT
   git remote set-url origin https://YOUR_USERNAME:YOUR_PAT@github.com/jitheng/tiered-pricing-app.git

   # Push all branches
   git push -u origin main
   git push -u origin dev
   git push -u origin staging
   git push -u origin prod
   ```

### Option 3: SSH Key

1. **Generate SSH key (if you don't have one):**
   ```bash
   ssh-keygen -t ed25519 -C "your_email@example.com"
   eval "$(ssh-agent -s)"
   ssh-add ~/.ssh/id_ed25519
   ```

2. **Add SSH key to GitHub:**
   - Copy public key: `cat ~/.ssh/id_ed25519.pub`
   - Go to GitHub → Settings → SSH and GPG keys → New SSH key
   - Paste the public key

3. **Update remote to use SSH:**
   ```bash
   cd "/Users/dixita/Desktop/TestApp/Tiered Pricing/tiered-pricing"
   git remote set-url origin git@github.com:jitheng/tiered-pricing-app.git

   # Push all branches
   git push -u origin main
   git push -u origin dev
   git push -u origin staging
   git push -u origin prod
   ```

---

## Branch Protection Rules (Recommended)

Once you've pushed all branches, configure branch protection on GitHub:

### 1. Protect the `prod` branch

Go to: `https://github.com/jitheng/tiered-pricing-app/settings/branches`

Click **Add rule** for `prod`:
- ✅ Require pull request reviews before merging (1 approval)
- ✅ Require status checks to pass before merging
- ✅ Require branches to be up to date before merging
- ✅ Include administrators (optional, for extra safety)
- ✅ Require linear history

### 2. Protect the `staging` branch

Click **Add rule** for `staging`:
- ✅ Require pull request reviews before merging (1 approval)
- ✅ Require status checks to pass before merging

### 3. Protect the `main` branch

Click **Add rule** for `main`:
- ✅ Require pull request reviews before merging
- ✅ Lock branch (make read-only, only merge from prod)

---

## Deployment Strategy

### Vercel Deployment Configuration

Once branches are pushed, configure Vercel deployments:

1. **Production Deployment (prod branch):**
   - Vercel dashboard → Project Settings → Git
   - Production Branch: `prod`
   - Every push to `prod` triggers production deployment

2. **Preview Deployments (staging branch):**
   - Vercel automatically creates preview deployments for `staging`
   - URL: `https://tiered-pricing-app-git-staging-yourteam.vercel.app`
   - Use this for QA testing

3. **Development (dev branch):**
   - Local development only (`npm run dev`)
   - Optionally deploy to Vercel preview for sharing

---

## Common Git Commands

```bash
# Check current branch
git branch

# Check status
git status

# View commit history
git log --oneline --graph --all

# Sync dev with remote
git checkout dev
git pull origin dev

# Create a feature branch
git checkout -b feature/new-tier-type

# Merge feature back to dev
git checkout dev
git merge feature/new-tier-type
git branch -d feature/new-tier-type  # Delete feature branch

# See differences between branches
git diff staging..prod

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Discard all local changes
git reset --hard HEAD
```

---

## Hotfix Workflow

For urgent production fixes:

```bash
# Create hotfix branch from prod
git checkout prod
git checkout -b hotfix/urgent-discount-bug

# Make the fix
git add .
git commit -m "Fix discount calculation bug"

# Merge to prod
git checkout prod
git merge hotfix/urgent-discount-bug
git push origin prod

# Also merge back to staging and dev
git checkout staging
git merge hotfix/urgent-discount-bug
git push origin staging

git checkout dev
git merge hotfix/urgent-discount-bug
git push origin dev

# Delete hotfix branch
git branch -d hotfix/urgent-discount-bug
```

---

## Troubleshooting

### Error: "Updates were rejected because the remote contains work that you do not have locally"

```bash
# Pull remote changes first
git pull origin dev --rebase

# Then push
git push origin dev
```

### Error: "Merge conflict"

```bash
# Check conflicted files
git status

# Open conflicted files and resolve conflicts
# Look for <<<<<<< HEAD and >>>>>>> markers

# After resolving
git add .
git commit -m "Resolve merge conflict"
```

### Error: "Authentication failed"

- Use one of the authentication methods above (GitHub CLI, PAT, or SSH)

### Accidentally committed to wrong branch

```bash
# If you committed to main instead of dev
git checkout main
git reset --soft HEAD~1  # Undo commit, keep changes

git checkout dev
git add .
git commit -m "Your commit message"
```

---

## Release Versioning (Optional)

Use semantic versioning for releases:

```bash
# Tag a release
git checkout prod
git tag -a v1.0.0 -m "Release v1.0.0: Initial public release"
git push origin v1.0.0

# List all tags
git tag

# Checkout a specific version
git checkout v1.0.0
```

**Version format:** `vMAJOR.MINOR.PATCH`
- **MAJOR**: Breaking changes (e.g., v2.0.0)
- **MINOR**: New features, backward compatible (e.g., v1.1.0)
- **PATCH**: Bug fixes (e.g., v1.0.1)

---

## Summary

### Branches
- **dev** → Active development
- **staging** → Pre-production testing
- **prod** → Production
- **main** → Archive (mirror of prod)

### Workflow
1. Develop on **dev**
2. Merge to **staging** for testing
3. Merge to **prod** for production
4. Sync **main** with **prod**

### Current Task
**Authenticate with GitHub and push all branches using one of the methods above.**

After pushing, verify all branches on GitHub:
`https://github.com/jitheng/tiered-pricing-app/branches`
