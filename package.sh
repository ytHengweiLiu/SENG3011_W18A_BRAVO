#!/bin/bash

# Package data-collect.js
cd src/data-collect
npm install
zip -r ../../terraform/lambda-deployment-package-collect.zip .

# Package data-retrieve.js
cd ../data-retrieve
npm install
zip -r ../../terraform/lambda-deployment-package-retrieve.zip .

# Run terraform
cd ../../terraform
terraform init
terraform apply

# Remove zip files
rm lambda-deployment-package-collect.zip lambda-deployment-package-retrieve.zip