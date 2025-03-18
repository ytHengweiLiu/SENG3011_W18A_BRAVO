#!/bin/bash

# Set workspace environment
WORKSPACE=${1:-dev}  # Default to 'dev' if no argument is provided
echo "Building for workspace: $WORKSPACE"

cd src/data-collect
npm install
zip -r ../../terraform/lambda-deployment-package-collect-${WORKSPACE}.zip .

cd ../data-retrieve
npm install
zip -r ../../terraform/lambda-deployment-package-retrieve-${WORKSPACE}.zip .

cd ../analytical-model
npm install
zip -r ../../terraform/lambda-deployment-package-analyse-${WORKSPACE}.zip .

cd ../../terraform
terraform init
terraform workspace select ${WORKSPACE} || terraform workspace new ${WORKSPACE}
terraform apply

# Remove zip files
# rm lambda-deployment-package-collect-${WORKSPACE}.zip lambda-deployment-package-retrieve-${WORKSPACE}.zip lambda-deployment-package-analyse-${WORKSPACE}.zip
