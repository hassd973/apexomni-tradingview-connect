# ApeX Omni apexomni-tradingview-connect Tutorial

This tutorial is to help automate your trading strategies by connecting TradingView's alerts to ApeX Omni exchange's(https://omni.apex.exchange/trade) API.
Here's a step-by-step guide. It's all free!!

https://tradingview-connector.gitbook.io/tradingview-alert-connector-tutorial/

# Installation

```bash
git clone https://github.com/cj2094/apexomni-tradingview-connect
cd apexomni-tradingview-connect
npm install --force
```

# Quick Start

### with Docker

```bash
docker-compose build
docker-compose up -d
```

### without Docker

```bash
yarn start
```

# Drift SDK Project

The `drift-sdk-project` folder contains a minimal example showing how to use the
[Drift Protocol](https://github.com/drift-labs/protocol-v2) SDK. To try it out:

```bash
cd drift-sdk-project
npm install
npm start
```

This script initializes a `DriftClient`. Extend it with your own trading logic.
