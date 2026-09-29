acr-deploy:
	@echo "Deploying to Azure Container Registry..."
	az acr login --name $(ACR_NAME)
	docker build -t $(ACR_NAME).azurecr.io/$(IMAGE_NAME):$(TAG) .
	docker push $(ACR_NAME).azurecr.io/$(IMAGE_NAME):$(TAG)
