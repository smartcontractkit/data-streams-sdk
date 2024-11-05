package streams_test

import (
	"context"
	"os"
	"time"

	streams "github.com/smartcontractkit/data-streams-sdk/go"
	"github.com/smartcontractkit/data-streams-sdk/go/feed"
	streamsReport "github.com/smartcontractkit/data-streams-sdk/go/report"
	v3 "github.com/smartcontractkit/data-streams-sdk/go/report/v3"
)

func ExampleClient() {
	cfg := streams.Config{
		ApiKey:    "mykey",
		ApiSecret: "mysecret",
		RestURL:   "https://streams.url",
		WsURL:     "https://streams.url",
		Logger:    streams.LogPrintf,
	}

	streamsClient, err := streams.New(cfg)
	if err != nil {
		streams.LogPrintf("error creating client: %s", err)
		os.Exit(1)
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	availableFeeds, err := streamsClient.GetFeeds(ctx)
	cancel()
	if err != nil {
		streams.LogPrintf("error fetching feeds: %s", err)
		os.Exit(1)
	}

	f := availableFeeds[0]
	ctx, cancel = context.WithTimeout(context.Background(), time.Second)
	report, err := streamsClient.GetLatestReport(ctx, f.FeedID)
	cancel()
	if err != nil {
		streams.LogPrintf("error fetching latest report: %s", err)
		os.Exit(1)
	}

	streams.LogPrintf("report feedID: %s, observations_timestamp: %d, valid_from_timestamp: %d",
		report.FeedID, report.ObservationsTimestamp, report.ValidFromTimestamp)

	ctx, cancel = context.WithTimeout(context.Background(), time.Second)
	reports, err := streamsClient.GetReports(
		ctx, []feed.ID{availableFeeds[0].FeedID, availableFeeds[1].FeedID}, uint64(time.Now().Unix())-3)
	cancel()
	if err != nil {
		streams.LogPrintf("error fetching reports: %s", err)
		os.Exit(1)
	}

	for _, report = range reports {
		decoded, err := streamsReport.Decode[v3.Data](report.FullReport)
		if err != nil {
			streams.LogPrintf("error decoding decoded: %s", err)
			os.Exit(1)
		}

		streams.LogPrintf("report feedID: %s, observations_timestamp: %d, valid_from_timestamp: %d",
			report.FeedID, report.ObservationsTimestamp, report.ValidFromTimestamp)
		streams.LogPrintf(
			"FeedID: %s, FeedVersion: %d, Bid: %s, Ask: %s, BenchMark: %s, LinkFee: %s, NativeFee: %s, ValidFromTS: %d, ExpiresAt: %d",
			decoded.Data.FeedID.String(),
			decoded.Data.FeedID.Version(),
			decoded.Data.Bid.String(),
			decoded.Data.Ask.String(),
			decoded.Data.BenchmarkPrice.String(),
			decoded.Data.LinkFee.String(),
			decoded.Data.NativeFee.String(),
			decoded.Data.ValidFromTimestamp,
			decoded.Data.ExpiresAt,
		)
	}
}

func ExampleStream() {
	cfg := streams.Config{
		ApiKey:    "mykey",
		ApiSecret: "mysecret",
		RestURL:   "https://streams.url",
		WsURL:     "https://streams.url",
		Logger:    streams.LogPrintf,
	}

	client, err := streams.New(cfg)
	if err != nil {
		streams.LogPrintf("error creating client: %s", err)
		os.Exit(1)
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	availableFeeds, err := client.GetFeeds(ctx)
	cancel()
	if err != nil {
		streams.LogPrintf("error fetching feeds: %s", err)
		os.Exit(1)
	}

	ctx, cancel = context.WithTimeout(context.Background(), time.Second)
	stream, err := client.StreamWithStatusCallback(
		ctx, []feed.ID{availableFeeds[0].FeedID, availableFeeds[1].FeedID},
		func(isConnected bool, host string, origin string) {
			streams.LogPrintf("Host: %s, Origin: %s, isConnected: %s", host, origin, isConnected)
		})
	cancel()
	if err != nil {
		streams.LogPrintf("error subscribing: %s", err)
		os.Exit(1)
	}

	defer stream.Close()
	for stream.Stats().Accepted < 100 {
		report, err := stream.Read(context.Background())
		if err != nil {
			streams.LogPrintf("error reading from stream: %s", err)
			os.Exit(1)
		}

		streams.LogPrintf("report feedID: %s, observations_timestamp: %d, valid_from_timestamp: %d",
			report.FeedID, report.ObservationsTimestamp, report.ValidFromTimestamp)

		decoded, err := streamsReport.Decode[v3.Data](report.FullReport)
		if err != nil {
			streams.LogPrintf("error decoding decoded: %s", err)
			os.Exit(1)
		}

		streams.LogPrintf(
			"FeedID: %s, FeedVersion: %d, Bid: %s, Ask: %s, BenchMark: %s, LinkFee: %s, NativeFee: %s, ValidFromTS: %d, ExpiresAt: %d",
			decoded.Data.FeedID.String(),
			decoded.Data.FeedID.Version(),
			decoded.Data.Bid.String(),
			decoded.Data.Ask.String(),
			decoded.Data.BenchmarkPrice.String(),
			decoded.Data.LinkFee.String(),
			decoded.Data.NativeFee.String(),
			decoded.Data.ValidFromTimestamp,
			decoded.Data.ExpiresAt,
		)

		streams.LogPrintf("stream stats: %s", stream.Stats().String())
	}
}
