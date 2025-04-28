FROM public.ecr.aws/lambda/python:3.11

# Create layer directory
RUN mkdir -p /python/lib/python3.11/site-packages

# Set working directory for layer packaging
WORKDIR /python

# Copy requirements
COPY requirements.txt .

# Install dependencies into site-packages
RUN pip install -r requirements.txt -t lib/python3.11/site-packages

# Optional cleanup (reduce layer size)
RUN find . -type d -name "__pycache__" -exec rm -r {} + && \
    find . -type d -name "*.dist-info" -exec rm -r {} +
