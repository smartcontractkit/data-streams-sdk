.PHONY: all tidy lint test

all: tidy lint test

tidy:
	cd go && go mod tidy && cd ..

lint:
	cd go && golangci-lint run && cd ..

test:
	cd go && go test -race -cover ./... && cd ..