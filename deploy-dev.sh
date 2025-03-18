#!/bin/bash

set -e  # Exit immediately on error

WORKSPACE=${1:-dev}  # Default to 'dev' if no argument is provided
echo "Deploying to workspace: $WORKSPACE"

# Package data-collect.js
cd src/data-collect
npm install
zip -r ../../terraform/lambda-deployment-package-collect-${WORKSPACE}.zip .

# Package data-retrieve.js
cd ../data-retrieve
npm install
zip -r ../../terraform/lambda-deployment-package-retrieve-${WORKSPACE}.zip .

# Package analytical model
cd ../analytical-model
npm install
zip -r ../../terraform/lambda-deployment-package-analyse-${WORKSPACE}.zip .

# Terraform deployment
cd ../../terraform
terraform init
terraform workspace select ${WORKSPACE} || terraform workspace new ${WORKSPACE}

echo "Running Terraform Plan for workspace ${WORKSPACE}..."
terraform plan -out=tfplan

echo "Applying Terraform changes in workspace ${WORKSPACE}..."
terraform apply tfplan

# Clean up
rm lambda-deployment-package-collect-${WORKSPACE}.zip lambda-deployment-package-retrieve-${WORKSPACE}.zip lambda-deployment-package-analyse-${WORKSPACE}.zip

echo "Deployment to ${WORKSPACE} complete!"
