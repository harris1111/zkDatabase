#!/bin/bash

cd ..

cd packages/storage
yarn run build
yarn link
cd ../..

cd packages/serverless
yarn link @zkdb/storage
cd ../mina-service
yarn link @zkdb/storage

cd ../..
