class FeedbackError(Exception):
    """Base of every rule of this context the API translates into a response."""


class AboutSomeoneOutsideComplaintError(FeedbackError, ValueError):
    """Only a complaint may name the person it is about; a suggestion or a praise is about the app."""

    def __init__(self, kind: object) -> None:
        super().__init__(f"a {kind} does not name anyone")


class FeedbackLimitError(FeedbackError):
    """The account sent as many opinions as its window allows."""
