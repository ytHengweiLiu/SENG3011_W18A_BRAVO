#!/bin/bash

set -e  # Exit immediately on error

WORKSPACE="prod"
echo "Deploying to production workspace: $WORKSPACE"

# Package data-collect.js
cd src/data-collect
npm install
zip -r ../../terraform/lambda-deployment-package-collect.zip .

# Package data-retrieve.js
cd ../data-retrieve
npm install
zip -r ../../terraform/lambda-deployment-package-retrieve.zip .

# Package analytical model
cd ../analytical-model
npm install
zip -r ../../terraform/lambda-deployment-package-analyse.zip .

# Terraform deployment
cd ../../terraform
terraform init
terraform workspace select default

echo "Running Terraform Plan for production..."
terraform plan -out=tfplan

echo "Applying Terraform changes in production..."
terraform apply tfplan

# Clean up
rm lambda-deployment-package-collect.zip lambda-deployment-package-retrieve.zip lambda-deployment-package-analyse.zip

echo "Production deployment complete!"
