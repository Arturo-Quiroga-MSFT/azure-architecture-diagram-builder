export $(cat .env | grep -v '^#' | xargs) && az acr build --registry acrazurediagrams1767583743 \
    --image azure-diagram-builder:latest \
    --build-arg VITE_AZURE_OPENAI_ENDPOINT="$VITE_AZURE_OPENAI_ENDPOINT" \
    --build-arg VITE_AZURE_OPENAI_API_KEY="$VITE_AZURE_OPENAI_API_KEY" \
    --build-arg VITE_AZURE_OPENAI_DEPLOYMENT="$VITE_AZURE_OPENAI_DEPLOYMENT" \
    --build-arg VITE_REASONING_EFFORT="${VITE_REASONING_EFFORT:-medium}" . \
&& az containerapp update --name azure-diagram-builder \
    --resource-group azure-diagrams-rg \
    --image acrazurediagrams1767583743.azurecr.io/azure-diagram-builder:latest \
    --set-env-vars \
        AZURE_COSMOS_ENDPOINT="$AZURE_COSMOS_ENDPOINT" \
        COSMOS_DATABASE_ID="$COSMOS_DATABASE_ID" \
        COSMOS_CONTAINER_ID="$COSMOS_CONTAINER_ID" \
        PUBLIC_URL="https://azure-diagram-builder.yellowmushroom-f11e57c2.eastus2.azurecontainerapps.io" \
    --revision-suffix v$(date +%s)