# Dockerfile for Exposed Git Repository Lab
FROM node:20-alpine
RUN apk add --no-cache git
WORKDIR /app
COPY package.json .
RUN npm install --silent

# Setup Stage 1: Basic git history flag
RUN echo "FLAG{git_repo_secrets_dumped}" > flag.txt && \
    git init . && \
    git config user.email "admin@hackme.org" && \
    git config user.name "Administrator" && \
    git add flag.txt && git commit -m "Add flag" && \
    rm flag.txt && git add . && git commit -m "Remove flag"

# Setup Stage 2: Secret in a separate branch
RUN git checkout -b secret-branch && \
    echo "FLAG{git_branch_secret_recovery}" > secret_config.txt && \
    git add secret_config.txt && git commit -m "Add secret branch config" && \
    rm secret_config.txt && git add . && git commit -m "Clean secret branch" && \
    git checkout master

# Setup Stage 3: Packed objects via git gc
RUN echo "FLAG{git_packfile_blob_extraction}" > packed_secret.txt && \
    git add packed_secret.txt && git commit -m "Add packed secret" && \
    rm packed_secret.txt && git add . && git commit -m "Remove packed secret" && \
    git gc --aggressive && \
    mv .git/objects/pack/pack-*.pack /tmp/temp.pack && \
    mv .git/objects/pack/pack-*.idx /tmp/temp.idx && \
    git unpack-objects < /tmp/temp.pack && \
    mv /tmp/temp.pack .git/objects/pack/ && \
    mv /tmp/temp.idx .git/objects/pack/

# Setup Stage 4: Stash entry
RUN echo "FLAG{git_stash_reflog_recovery_expert}" > stash_secret.txt && \
    git add stash_secret.txt && \
    git stash save "secret stash entry"

COPY public public
COPY server.js .
EXPOSE 3000
CMD ["node", "server.js"]
