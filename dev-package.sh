#!/bin/bash

# Set workspace environment
WORKSPACE=${1:-dev}  # Default to 'dev' if no argument is provided
echo "Building for workspace: $WORKSPACE"

# Create environment-specific directory for data-transform
mkdir -p src/data-transform
# Copy the new data-transform.js file to this directory
cp data-transform.js src/data-transform/

# Package data-transform.js (replaces data-collect.js for ADAGE 3.0 format)
cd src/data-transform
npm init -y
npm install axios cheerio @aws-sdk/client-s3
zip -r ../../terraform/lambda-deployment-package-transform-${WORKSPACE}.zip .

# Package data-retrieve.js with environment suffix
cd ../data-retrieve
npm install
zip -r ../../terraform/lambda-deployment-package-retrieve-${WORKSPACE}.zip .

# Package analytical-model with environment suffix
cd ../analytical-model
npm install
zip -r ../../terraform/lambda-deployment-package-analyse-${WORKSPACE}.zip .

# Run terraform with the specified workspace
cd ../../terraform
terraform init
terraform workspace select ${WORKSPACE} || terraform workspace new ${WORKSPACE}
terraform apply

# Remove zip files
# rm lambda-deployment-package-transform-${WORKSPACE}.zip lambda-deployment-package-retrieve-${WORKSPACE}.zip lambda-deployment-package-analyse-${WORKSPACE}.zip
