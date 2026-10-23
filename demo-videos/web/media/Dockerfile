# Static host for the video tour: the files publish-web.sh writes, served by nginx at /videos/.
# Built by deploy-media.sh from a staging folder that holds this Dockerfile, nginx.conf and videos/.
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY videos/ /usr/share/nginx/html/videos/
EXPOSE 80
