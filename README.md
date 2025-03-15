# SENG3011 BRAVO

## NBA Stats Scraper and Analyzer

his project is a serverless application that scrapes NBA team stats from a website, stores the data in an S3 bucket, and provides an API to retrieve and analyze the data. The application is built using AWS Lambda, API Gateway, S3, and Terraform for infrastructure as code.

### Team Members

- Katherine
- Hengwei
- Fai
- Afif

---

## Project Overview

- Data Collection
- Data Retrieval
- Data Analysis

---

## **Architecture**
The application consists of the following components:
1. **AWS Lambda Functions**:
   - `data-collect`: Scrapes NBA stats and uploads them to S3.
   - `data-retrieve`: Retrieves the latest stats from S3.
   - `data-analyze`: Analyzes the stats to determine the winning team.
2. **API Gateway**: Exposes endpoints to trigger the Lambda functions.
3. **S3 Bucket**: Stores the scraped data in JSON format.
4. **Terraform**: Manages the infrastructure as code.

---
 
## API Documentation

Full documentation can be accessed at: Swagger doucmentation

---

## **Getting Started**

### **Prerequisites**
- [Node.js](https://nodejs.org/) (v18 or higher)
- [Terraform](https://www.terraform.io/) (v1.5 or higher)
- [AWS CLI](https://aws.amazon.com/cli/) (configured with your credentials)
- An AWS account with the necessary permissions.

---

1. Clone the repository:
    ```
    git clone https://github.com/ytHengweiLiu/SENG3011_W18A_BRAVO.git
    cd SENG3011_W18A_BRAVO
    ```

2. Run the Deployment Script:
    Use the package.sh script to package the Lambda functions, deploy the infrastructure, and clean up the deployment packages:
    ```
   chmod +x package.sh  # Make the script executable
    ./package.sh
    ```
This script will:
- Install dependencies for each Lambda function.
- Package the Lambda functions into ZIP files.
- Deploy the infrastructure using Terraform.
- Remove the ZIP files after deployment.

---
 
## CI/CD Pipeline

The project uses a CI/CD pipeline to automate testing, building, and deployment:
1. Continuous Integration (CI):
- Runs tests and builds deployment packages.
- Uploads the packages to S3.

2. Continuous Deployment (CD):
- Deploys the infrastructure using Terraform.
- Updates the Lambda functions with the latest cod

---

## Scheduled updates:
The data-collect Lambda function is scheduled to run daily at 12:00 PM UTC using a CloudWatch Event Rule. This ensures that the stats are always up-to-date.

---

## Contributing

Pull requests are welcome. For major changes, please open an issue first
to discuss what you would like to change.

Please make sure to update tests as appropriate.

## License

[MIT](https://choosealicense.com/licenses/mit/)
