#!/usr/bin/env node

/**
 * Test Docker Build Script
 * 
 * This script helps test the Docker build process locally
 * to identify and resolve build issues before deployment.
 */

const { execSync } = require('child_process');
const fs = require('fs');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  // eslint-disable-next-line no-console
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkPrerequisites() {
  log('\n🔍 Checking prerequisites...', 'blue');
  
  // Check if Docker is installed
  try {
    execSync('docker --version', { stdio: 'pipe' });
    log('✅ Docker is installed', 'green');
  } catch (error) {
    log('❌ Docker is not installed or not in PATH', 'red');
    process.exit(1);
  }
  
  // Check if package.json exists
  if (!fs.existsSync('package.json')) {
    log('❌ package.json not found', 'red');
    process.exit(1);
  }
  log('✅ package.json found', 'green');
  
  // Check if package-lock.json exists
  if (!fs.existsSync('package-lock.json')) {
    log('⚠️  package-lock.json not found - this may cause build issues', 'yellow');
    log('   Run "npm install" to generate package-lock.json', 'yellow');
  } else {
    log('✅ package-lock.json found', 'green');
  }
  
  // Check if Dockerfile exists
  if (!fs.existsSync('Dockerfile')) {
    log('❌ Dockerfile not found', 'red');
    process.exit(1);
  }
  log('✅ Dockerfile found', 'green');
}

function testDockerBuild() {
  log('\n🏗️  Starting Docker build test...', 'blue');
  
  try {
    // Build the Docker image
    log('Building Docker image...', 'yellow');
    execSync('docker build -t kni-platform-test .', { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    log('\n✅ Docker build completed successfully!', 'green');
    log('\n📋 Next steps:', 'blue');
    log('1. Test the image: docker run -p 3000:3000 kni-platform-test', 'reset');
    log('2. Clean up: docker rmi kni-platform-test', 'reset');
    
  } catch (error) {
    log('\n❌ Docker build failed!', 'red');
    log('\n🔧 Troubleshooting tips:', 'yellow');
    log('1. Check if all dependencies are properly categorized in package.json', 'reset');
    log('2. Ensure package-lock.json is up to date (run "npm install")', 'reset');
    log('3. Verify all required files are not excluded by .dockerignore', 'reset');
    log('4. Check Docker daemon is running', 'reset');
    process.exit(1);
  }
}

function main() {
  log('🐳 KNI Platform Docker Build Test', 'bright');
  log('==================================', 'bright');
  
  checkPrerequisites();
  testDockerBuild();
}

if (require.main === module) {
  main();
}

module.exports = { checkPrerequisites, testDockerBuild };