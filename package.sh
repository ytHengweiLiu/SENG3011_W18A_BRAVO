#!/bin/bash

# Package data-collect.js
cd src/data-collect
npm install
zip -r ../../terraform/lambda-deployment-package-collect.zip .

# Package data-retrieve.js
cd ../data-retrieve
npm install
zip -r ../../terraform/lambda-deployment-package-retrieve.zip .