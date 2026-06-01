FROM python:3.10-alpine
WORKDIR /app
RUN pip install --no-cache-dir flask requests
COPY app.py .
EXPOSE 3000
CMD ["python", "app.py"]
