set shell := ["bash", "-i", "-c"]

install:
    nvm install $(cat .nvmrc)
    nvm use $(cat .nvmrc)
    npm install

start:
    npm start

dev:
    npm run dev

build:
    npm run build

dist:
    npm run dist

check:
    npm run check

check-write:
    npm run check:write
