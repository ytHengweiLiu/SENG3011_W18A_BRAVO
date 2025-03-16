#!/bin/bash

# Package data-collect.js
cd src/data-collect
npm install
zip -r ../../terraform/lambda-deployment-package-collect.zip .

# Package data-retrieve.js
cd ../data-retrieve
npm install
zip -r ../../terraform/lambda-deployment-package-retrieve.zip .

cd ../analytical-model
npm install
zip -r ../../terraform/lambda-deployment-package-analyse.zip .

# cd src/analytical-model
# npm install
# zip -r ../../terraform/lambda-deployment-package-analytics.zip .

# Run terraform
cd ../../terraform
terraform init
terraform apply

# Remove zip files
# rm lambda-deployment-package-collect.zip lambda-deployment-package-retrieve.zip lambda-deployment-package-analyse.zip
# rm lambda-deployment-package-analytics.zip
