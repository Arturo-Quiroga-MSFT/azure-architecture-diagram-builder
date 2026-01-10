export $(cat .env | grep -v '^#' | xargs) && az acr build --registry acrazurediagrams1767583743 \
    --image azure-diagram-builder:latest \
    --build-arg VITE_AZURE_OPENAI_ENDPOINT="$VITE_AZURE_OPENAI_ENDPOINT" \
    --build-arg VITE_AZURE_OPENAI_API_KEY="$VITE_AZURE_OPENAI_API_KEY" \
    --build-arg VITE_AZURE_OPENAI_DEPLOYMENT="$VITE_AZURE_OPENAI_DEPLOYMENT" . \
&& az containerapp update --name azure-diagram-builder --resource-group azure-diagrams-rg --image acrazurediagrams1767583743.azurecr.io/azure-diagram-builder:latest --revision-suffix v$(date +%s)